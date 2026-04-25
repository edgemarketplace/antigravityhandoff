import { headers } from "next/headers";
import { NextResponse } from "next/server";
import type Stripe from "stripe";
import { getStripe } from "@/lib/stripe";
import { createPrintifyOrder } from "@/lib/printify";
import { getSupabaseAdminClient } from "@/lib/supabase-admin";
import { recordPaidOrderUsage } from "@/lib/usage-tracking";

function splitName(fullName?: string | null) {
  if (!fullName) {
    return { firstName: "", lastName: "" };
  }

  const parts = fullName.trim().split(/\s+/);
  return {
    firstName: parts[0] ?? "",
    lastName: parts.slice(1).join(" ") || "",
  };
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
  const lineItems = await stripe.checkout.sessions.listLineItems(sessionId, {
    limit: 100,
    expand: ["data.price.product"],
  });

  const mapped = lineItems.data
    .map((lineItem) => {
      const product = lineItem.price && typeof lineItem.price.product === "object" ? lineItem.price.product : null;

      const productMetadata = product && "deleted" in product ? null : product?.metadata;

      const printifyProductId = productMetadata?.printify_product_id;
      const printifyVariantId = Number(productMetadata?.printify_variant_id ?? "");

      if (!printifyProductId || !Number.isFinite(printifyVariantId) || printifyVariantId <= 0) {
        return null;
      }

      return {
        product_id: printifyProductId,
        variant_id: printifyVariantId,
        quantity: lineItem.quantity ?? 1,
      };
    })
    .filter((item): item is { product_id: string; variant_id: number; quantity: number } => Boolean(item));

  if (!mapped.length) {
    throw new Error("No valid Printify line items found in Stripe line items metadata.");
  }

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

async function markOrderPaid(session: Stripe.Checkout.Session) {
  const supabase = getSupabaseAdminClient();
  const orderId = session.metadata?.order_id ?? session.id;
  const shipping = getShippingSource(session);

  const { error } = await supabase.from("orders").upsert(
    {
      id: orderId,
      tenant_id: session.metadata?.tenant_id ?? null,
      stripe_session_id: session.id,
      customer_email: session.customer_details?.email ?? null,
      shipping_address: shipping.address ?? null,
      status: "Paid",
      paid_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    },
    { onConflict: "id" },
  );

  if (error) {
    throw new Error(`Could not mark order as paid: ${error.message}`);
  }

  return orderId;
}

async function resolveTenantIdFromSubscription(subscription: Stripe.Subscription): Promise<string | null> {
  const fromMetadata = subscription.metadata?.tenant_id?.trim();
  if (fromMetadata) {
    return fromMetadata;
  }

  const supabase = getSupabaseAdminClient();

  const { data: bySubscription } = await supabase
    .from("tenants")
    .select("id")
    .eq("stripe_subscription_id", subscription.id)
    .maybeSingle();

  if (bySubscription?.id) {
    return bySubscription.id as string;
  }

  const customerId = typeof subscription.customer === "string" ? subscription.customer : null;
  if (!customerId) {
    return null;
  }

  const { data: byCustomer } = await supabase
    .from("tenants")
    .select("id")
    .eq("stripe_customer_id", customerId)
    .maybeSingle();

  return (byCustomer?.id as string | undefined) ?? null;
}

async function setTenantPlanFromSubscription(params: {
  tenantId: string;
  customerId: string | null;
  subscriptionId: string;
  isGrowthActive: boolean;
}) {
  const supabase = getSupabaseAdminClient();

  const updates: Record<string, unknown> = {
    current_plan: params.isGrowthActive ? "growth" : "free",
    stripe_subscription_id: params.isGrowthActive ? params.subscriptionId : null,
    plan_updated_at: new Date().toISOString(),
    growth_plan_activated_at: params.isGrowthActive ? new Date().toISOString() : null,
  };

  if (params.customerId) {
    updates.stripe_customer_id = params.customerId;
  }

  const { error } = await supabase.from("tenants").update(updates).eq("id", params.tenantId);

  if (error) {
    throw new Error(`Could not sync tenant subscription state: ${error.message}`);
  }
}

function isGrowthSubscriptionActive(status: Stripe.Subscription.Status): boolean {
  return status === "active" || status === "trialing" || status === "past_due" || status === "unpaid";
}

async function handleGrowthUpgradeCheckoutCompleted(session: Stripe.Checkout.Session) {
  const tenantId = session.metadata?.tenant_id?.trim();
  if (!tenantId) {
    throw new Error("Growth upgrade checkout is missing tenant_id metadata.");
  }

  const subscriptionId = typeof session.subscription === "string" ? session.subscription : null;
  if (!subscriptionId) {
    throw new Error("Growth upgrade checkout is missing subscription id.");
  }

  const customerId = typeof session.customer === "string" ? session.customer : null;

  await setTenantPlanFromSubscription({
    tenantId,
    customerId,
    subscriptionId,
    isGrowthActive: true,
  });
}

async function handleSubscriptionLifecycleEvent(subscription: Stripe.Subscription) {
  const tenantId = await resolveTenantIdFromSubscription(subscription);
  if (!tenantId) {
    return;
  }

  const customerId = typeof subscription.customer === "string" ? subscription.customer : null;

  await setTenantPlanFromSubscription({
    tenantId,
    customerId,
    subscriptionId: subscription.id,
    isGrowthActive: isGrowthSubscriptionActive(subscription.status),
  });
}

async function handleCommerceCheckoutCompleted(session: Stripe.Checkout.Session) {
  const orderId = await markOrderPaid(session);

  const tenantId = session.metadata?.tenant_id;
  if (tenantId) {
    const amountCents = typeof session.amount_total === "number" ? session.amount_total : 0;
    await recordPaidOrderUsage({
      tenantId,
      orderId,
      amountCents,
    });
  }

  const line_items = await mapPrintifyLineItems(session.id);
  const address_to = assertAddress(session);

  const supabase = getSupabaseAdminClient();
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

    const { error } = await supabase
      .from("orders")
      .update({
        printify_order_id: printifyOrder.id,
        fulfillment_attempts: attemptsUsed,
        fulfillment_error: null,
        updated_at: new Date().toISOString(),
      })
      .eq("id", orderId);

    if (error) {
      throw new Error(`Order paid but could not record Printify order: ${error.message}`);
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown Printify fulfillment error.";

    await supabase
      .from("orders")
      .update({
        fulfillment_attempts: attemptsUsed,
        fulfillment_error: message,
        updated_at: new Date().toISOString(),
      })
      .eq("id", orderId);

    throw error;
  }
}

export async function POST(request: Request) {
  const signature = (await headers()).get("stripe-signature");
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

  if (!signature || !webhookSecret) {
    return NextResponse.json(
      { success: false, message: "Missing Stripe webhook signature or STRIPE_WEBHOOK_SECRET." },
      { status: 400 },
    );
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

      if (isGrowthUpgrade) {
        await handleGrowthUpgradeCheckoutCompleted(session);
      } else {
        await handleCommerceCheckoutCompleted(session);
      }
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
