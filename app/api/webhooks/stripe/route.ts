import { headers } from "next/headers";
import { NextResponse } from "next/server";
import type Stripe from "stripe";
import { getStripe } from "@/lib/stripe";
import { createPrintifyOrder } from "@/lib/printify";
import { getFirebaseAdminDb } from "@/lib/firebase-admin";
import { recordPaidOrderUsage } from "@/lib/usage-tracking";
import { computeEdgePaymentFee, normalizePaymentMode, normalizePercent } from "@/lib/monetization";

const resendApiKey = process.env.RESEND_API_KEY;
const notifyFromEmail = process.env.NOTIFY_FROM_EMAIL;

function splitName(fullName?: string | null) {
  if (!fullName) return { firstName: "", lastName: "" };
  const parts = fullName.trim().split(/\s+/);
  return { firstName: parts[0] ?? "", lastName: parts.slice(1).join(" ") || "" };
}

function getShippingSource(session: Stripe.Checkout.Session) {
  const shipping = session.collected_information?.shipping_details;
  const customer = session.customer_details;
  return {
    name: shipping?.name ?? customer?.name ?? "",
    email: customer?.email ?? "",
    phone: customer?.phone ?? undefined,
    address: shipping?.address ?? customer?.address,
  };
}

function assertAddress(session: Stripe.Checkout.Session) {
  const source = getShippingSource(session);
  const address = source.address;
  if (!address?.line1 || !address?.city || !address?.postal_code || !address?.country) {
    throw new Error("Missing required shipping fields in Stripe session.");
  }

  const { firstName, lastName } = splitName(source.name);
  return {
    first_name: firstName || "Customer",
    last_name: lastName || "",
    email: source.email || "unknown@example.com",
    phone: source.phone,
    country: address.country,
    region: address.state ?? undefined,
    city: address.city,
    address1: address.line1,
    address2: address.line2 ?? undefined,
    zip: address.postal_code,
  };
}

async function mapPrintifyLineItems(sessionId: string) {
  const stripe = getStripe();
  const lineItems = await stripe.checkout.sessions.listLineItems(sessionId, { limit: 100, expand: ["data.price.product"] });

  const mapped = lineItems.data
    .map((lineItem) => {
      const product = lineItem.price && typeof lineItem.price.product === "object" ? lineItem.price.product : null;
      const productMetadata = product && "deleted" in product ? null : product?.metadata;

      const printifyProductId = productMetadata?.printify_product_id;
      const printifyVariantId = Number(productMetadata?.printify_variant_id ?? "");
      if (!printifyProductId || !Number.isFinite(printifyVariantId) || printifyVariantId <= 0) return null;

      return { product_id: printifyProductId, variant_id: printifyVariantId, quantity: lineItem.quantity ?? 1 };
    })
    .filter((item): item is { product_id: string; variant_id: number; quantity: number } => Boolean(item));

  if (!mapped.length) throw new Error("No valid Printify line items found in Stripe line items metadata.");
  return mapped;
}

async function withRetry<T>(fn: () => Promise<T>, attempts = 3, baseDelayMs = 750): Promise<T> {
  let lastError: unknown;
  for (let i = 1; i <= attempts; i += 1) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;
      if (i < attempts) {
        const delay = baseDelayMs * 2 ** (i - 1);
        await new Promise((resolve) => setTimeout(resolve, delay));
      }
    }
  }
  throw lastError;
}

async function resolveStripeFeeFromSession(session: Stripe.Checkout.Session): Promise<number> {
  const paymentIntentId = typeof session.payment_intent === "string" ? session.payment_intent : null;
  if (!paymentIntentId) return 0;

  const stripe = getStripe();
  const paymentIntent = await stripe.paymentIntents.retrieve(paymentIntentId, { expand: ["latest_charge.balance_transaction"] });

  const latestCharge =
    paymentIntent.latest_charge && typeof paymentIntent.latest_charge === "object" && "balance_transaction" in paymentIntent.latest_charge
      ? paymentIntent.latest_charge
      : null;

  const balanceTx = latestCharge?.balance_transaction && typeof latestCharge.balance_transaction === "object" ? latestCharge.balance_transaction : null;
  const feeCents = typeof balanceTx?.fee === "number" ? balanceTx.fee : 0;
  return Number((feeCents / 100).toFixed(2));
}

async function markOrderPaid(session: Stripe.Checkout.Session) {
  const db = getFirebaseAdminDb();
  const orderId = session.metadata?.order_id ?? session.id;
  const shipping = getShippingSource(session);

  const totalPaid = typeof session.amount_total === "number" ? Number((session.amount_total / 100).toFixed(2)) : 0;
  const paymentMode = normalizePaymentMode(session.metadata?.payment_mode);
  const paymentFeePercent = normalizePercent(session.metadata?.payment_fee_percent, paymentMode === "edge" ? 5 : 0);
  const edgePaymentFee = computeEdgePaymentFee(totalPaid, paymentMode, paymentFeePercent);
  const subtotal = totalPaid;
  const stripeFee = await resolveStripeFeeFromSession(session);

  await db.collection("orders").doc(orderId).set(
    {
      id: orderId,
      tenant_id: session.metadata?.tenant_id ?? null,
      stripe_session_id: session.id,
      customer_email: session.customer_details?.email ?? null,
      shipping_address: shipping.address ?? null,
      status: "Paid",
      subtotal,
      stripe_fee: stripeFee,
      edge_payment_fee: edgePaymentFee,
      total_paid: totalPaid,
      amount_total: totalPaid,
      paid_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    },
    { merge: true },
  );

  return orderId;
}

async function resolveTenantIdFromSubscription(subscription: Stripe.Subscription): Promise<string | null> {
  const fromMetadata = subscription.metadata?.tenant_id?.trim();
  if (fromMetadata) return fromMetadata;

  const db = getFirebaseAdminDb();
  const bySub = await db.collection("tenants").where("stripe_subscription_id", "==", subscription.id).limit(1).get();
  if (!bySub.empty) return bySub.docs[0].id;

  const customerId = typeof subscription.customer === "string" ? subscription.customer : null;
  if (!customerId) return null;

  const byCustomer = await db.collection("tenants").where("stripe_customer_id", "==", customerId).limit(1).get();
  if (byCustomer.empty) return null;
  return byCustomer.docs[0].id;
}

async function setTenantPlanFromSubscription(params: {
  tenantId: string;
  customerId: string | null;
  subscriptionId: string;
  isGrowthActive: boolean;
}) {
  const db = getFirebaseAdminDb();
  const updates: Record<string, unknown> = {
    current_plan: params.isGrowthActive ? "growth" : "free",
    stripe_subscription_id: params.isGrowthActive ? params.subscriptionId : null,
    plan_updated_at: new Date().toISOString(),
    growth_plan_activated_at: params.isGrowthActive ? new Date().toISOString() : null,
  };
  if (params.customerId) updates.stripe_customer_id = params.customerId;

  await db.collection("tenants").doc(params.tenantId).set(updates, { merge: true });
}

function isGrowthSubscriptionActive(status: Stripe.Subscription.Status): boolean {
  return status === "active" || status === "trialing" || status === "past_due" || status === "unpaid";
}

async function handleGrowthUpgradeCheckoutCompleted(session: Stripe.Checkout.Session) {
  const tenantId = session.metadata?.tenant_id?.trim();
  if (!tenantId) throw new Error("Growth upgrade checkout is missing tenant_id metadata.");

  const subscriptionId = typeof session.subscription === "string" ? session.subscription : null;
  if (!subscriptionId) throw new Error("Growth upgrade checkout is missing subscription id.");

  const customerId = typeof session.customer === "string" ? session.customer : null;
  await setTenantPlanFromSubscription({ tenantId, customerId, subscriptionId, isGrowthActive: true });
}

async function handleSubscriptionLifecycleEvent(subscription: Stripe.Subscription) {
  const tenantId = await resolveTenantIdFromSubscription(subscription);
  if (!tenantId) return;

  const customerId = typeof subscription.customer === "string" ? subscription.customer : null;
  await setTenantPlanFromSubscription({
    tenantId,
    customerId,
    subscriptionId: subscription.id,
    isGrowthActive: isGrowthSubscriptionActive(subscription.status),
  });
}

async function createAutomationEmailEvent(params: {
  tenantId: string;
  eventType: "first_sale" | "upgrade_nudge";
  recipient: string;
  subject: string;
  body: string;
  dedupeKey: string;
}) {
  const db = getFirebaseAdminDb();
  const ref = db.collection("email_automation_events").doc(params.dedupeKey);
  const existing = await ref.get();
  if (existing.exists) return;

  await ref.set({
    tenant_id: params.tenantId,
    event_type: params.eventType,
    recipient: params.recipient,
    subject: params.subject,
    payload: { body: params.body },
    dedupe_key: params.dedupeKey,
    created_at: new Date().toISOString(),
  });

  if (resendApiKey && notifyFromEmail) {
    await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${resendApiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        from: notifyFromEmail,
        to: [params.recipient],
        subject: params.subject,
        html: `<div style=\"font-family:Inter,Arial,sans-serif;line-height:1.5\">${params.body}</div>`,
      }),
    }).catch(() => undefined);
  }
}

async function resolveTenantNotificationEmail(tenantId: string): Promise<string | null> {
  const db = getFirebaseAdminDb();
  const snap = await db
    .collection("onboarding_intakes")
    .where("tenant_id", "==", tenantId)
    .orderBy("created_at", "desc")
    .limit(1)
    .get();

  if (snap.empty) return null;
  const data = snap.docs[0].data() as { admin_email?: string };
  return data.admin_email ?? null;
}

async function maybeSendFirstSaleAndUpgradeNudges(tenantId: string, orderId: string) {
  const recipient = await resolveTenantNotificationEmail(tenantId);
  if (!recipient) return;

  const db = getFirebaseAdminDb();
  const tenantSnap = await db.collection("tenants").doc(tenantId).get();
  if (!tenantSnap.exists) return;

  const tenant = tenantSnap.data() as { name?: string; monthly_order_count?: number; monthly_fee_cents?: number };
  const monthKey = new Date().toISOString().slice(0, 7);
  const orderCount = Number(tenant.monthly_order_count ?? 0);
  const monthlyFeeCents = Number(tenant.monthly_fee_cents ?? 0);
  const monthlyFeeDollars = (monthlyFeeCents / 100).toFixed(2);

  if (orderCount === 1) {
    await createAutomationEmailEvent({
      tenantId,
      recipient,
      eventType: "first_sale",
      dedupeKey: `first-sale-${tenantId}`,
      subject: `🎉 First sale for ${tenant.name ?? "your store"}`,
      body: `<p>Congrats — your store just recorded its first sale.</p><p>Order id: <strong>${orderId}</strong></p>`,
    });
  }

  if (monthlyFeeCents >= 9_900) {
    await createAutomationEmailEvent({
      tenantId,
      recipient,
      eventType: "upgrade_nudge",
      dedupeKey: `upgrade-${tenantId}-${monthKey}`,
      subject: `You paid $${monthlyFeeDollars} in platform fees this month`,
      body: `<p>You have paid <strong>$${monthlyFeeDollars}</strong> in platform fees this month.</p><p>Growth is $99/month with 0% platform fees, so you may now save by upgrading.</p>`,
    });
  }
}

async function handleCommerceCheckoutCompleted(session: Stripe.Checkout.Session) {
  const orderId = await markOrderPaid(session);

  const tenantId = session.metadata?.tenant_id;
  if (tenantId) {
    const amountCents = typeof session.amount_total === "number" ? session.amount_total : 0;
    await recordPaidOrderUsage({ tenantId, orderId, amountCents });
    await maybeSendFirstSaleAndUpgradeNudges(tenantId, orderId);
  }

  const line_items = await mapPrintifyLineItems(session.id);
  const address_to = assertAddress(session);

  const db = getFirebaseAdminDb();
  let attemptsUsed = 0;

  try {
    const printifyOrder = await withRetry(async () => {
      attemptsUsed += 1;
      return createPrintifyOrder({
        external_id: orderId,
        line_items,
        address_to,
        send_shipping_notification: true,
      });
    });

    await db.collection("orders").doc(orderId).set(
      {
        printify_order_id: printifyOrder.id,
        fulfillment_attempts: attemptsUsed,
        fulfillment_error: null,
        updated_at: new Date().toISOString(),
      },
      { merge: true },
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown Printify fulfillment error.";
    await db.collection("orders").doc(orderId).set(
      {
        fulfillment_attempts: attemptsUsed,
        fulfillment_error: message,
        updated_at: new Date().toISOString(),
      },
      { merge: true },
    );
    throw error;
  }
}

export async function POST(request: Request) {
  const signature = (await headers()).get("stripe-signature");
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

  if (!signature || !webhookSecret) {
    return NextResponse.json({ success: false, message: "Missing Stripe webhook signature or STRIPE_WEBHOOK_SECRET." }, { status: 400 });
  }

  const body = await request.text();

  let event: Stripe.Event;
  try {
    const stripe = getStripe();
    event = stripe.webhooks.constructEvent(body, signature, webhookSecret);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Invalid webhook payload.";
    return NextResponse.json({ success: false, message }, { status: 400 });
  }

  try {
    if (event.type === "checkout.session.completed") {
      const session = event.data.object as Stripe.Checkout.Session;
      const isGrowthUpgrade = session.mode === "subscription" || session.metadata?.checkout_type === "growth_upgrade";
      if (isGrowthUpgrade) await handleGrowthUpgradeCheckoutCompleted(session);
      else await handleCommerceCheckoutCompleted(session);
    }

    if (event.type === "customer.subscription.created" || event.type === "customer.subscription.updated" || event.type === "customer.subscription.deleted") {
      await handleSubscriptionLifecycleEvent(event.data.object as Stripe.Subscription);
    }

    return NextResponse.json({ received: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Webhook handler failed.";
    return NextResponse.json({ success: false, message }, { status: 500 });
  }
}
