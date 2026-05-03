"use server";

import { randomUUID } from "node:crypto";
import { getStripe } from "@/lib/stripe";
import { getFirebaseAdminDb } from "@/lib/firebase-admin";
import type { CartItem } from "@/stores/cart";
import {
  computeEdgePaymentFee,
  normalizePaymentMode,
  normalizePercent,
  normalizeShippingMode,
  type PaymentMode,
  type ShippingMode,
} from "@/lib/monetization";

type DbProduct = {
  tenant_id: string | null;
  printify_id: string;
  title: string;
  price: number;
  image_url: string | null;
  variants: unknown;
};

type ProductVariant = {
  id: number;
  title: string;
  price: number;
  is_enabled?: boolean;
};

type TenantCheckoutSettings = {
  paymentMode: PaymentMode;
  shippingMode: ShippingMode;
  paymentFeePercent: number;
  shippingMarkupPercent: number;
  connectedAccountRef: string | null;
  connectedAccountStatus: string | null;
};

type PaymentAccountRow = {
  account_ref: string;
  status: string;
  created_at?: string;
};

type CheckoutSessionCreateParams = NonNullable<
  Parameters<ReturnType<typeof getStripe>["checkout"]["sessions"]["create"]>[0]
>;
type CheckoutPaymentIntentData = NonNullable<CheckoutSessionCreateParams["payment_intent_data"]>;

type ValidatedCartItem = CartItem & {
  printifyProductId: string;
  unitPrice: number;
  imageUrl: string | null;
};

export type CreateEmbeddedCheckoutInput = {
  items: CartItem[];
  customerEmail?: string;
};

function normalizeVariants(input: unknown): ProductVariant[] {
  if (!Array.isArray(input)) return [];
  const variants: ProductVariant[] = [];

  for (const row of input) {
    if (!row || typeof row !== "object") continue;
    const candidate = row as { id?: unknown; title?: unknown; price?: unknown; is_enabled?: unknown };

    if (typeof candidate.id !== "number" || !Number.isFinite(candidate.id)) continue;
    if (typeof candidate.price !== "number" || !Number.isFinite(candidate.price)) continue;

    variants.push({
      id: candidate.id,
      title: typeof candidate.title === "string" ? candidate.title : "",
      price: candidate.price,
      is_enabled: typeof candidate.is_enabled === "boolean" ? candidate.is_enabled : undefined,
    });
  }

  return variants;
}

function toStripeLineItem(item: ValidatedCartItem) {
  return {
    quantity: item.quantity,
    price_data: {
      currency: "usd",
      unit_amount: Math.round(item.unitPrice * 100),
      product_data: {
        name: item.name,
        images: item.imageUrl ? [item.imageUrl] : undefined,
        metadata: {
          printify_product_id: item.printifyProductId,
          printify_variant_id: item.printifyVariantId ? String(item.printifyVariantId) : "",
          cart_item_id: item.id,
        },
      },
    },
  };
}

function variantPriceDollars(variants: ProductVariant[], variantId: number): number | null {
  const match = variants.find((variant) => variant.id === variantId);
  if (!match) return null;
  if (match.is_enabled === false) return null;
  return Number((match.price / 100).toFixed(2));
}

async function resolveTenantCheckoutSettings(tenantId: string): Promise<TenantCheckoutSettings> {
  const db = getFirebaseAdminDb();
  const tenantSnap = await db.collection("tenants").doc(tenantId).get();
  if (!tenantSnap.exists) {
    throw new Error("Could not resolve tenant checkout settings: tenant not found");
  }

  const tenant = tenantSnap.data() as {
    payment_mode?: unknown;
    shipping_mode?: unknown;
    payment_fee_percent?: unknown;
    shipping_markup_percent?: unknown;
  };

  const paymentMode = normalizePaymentMode(tenant.payment_mode);
  const shippingMode = normalizeShippingMode(tenant.shipping_mode);
  const paymentFeePercent = normalizePercent(tenant.payment_fee_percent, paymentMode === "edge" ? 5 : 0);
  const shippingMarkupPercent = normalizePercent(tenant.shipping_markup_percent, shippingMode === "edge" ? 10 : 0);

  const accountsSnap = await db
    .collection("payment_accounts")
    .where("tenant_id", "==", tenantId)
    .where("provider", "==", "stripe_connect")
    .orderBy("created_at", "desc")
    .limit(5)
    .get();

  const rows = accountsSnap.docs
    .map((doc) => doc.data() as PaymentAccountRow)
    .filter((row) => Boolean(row.account_ref));

  const active = rows.find((row) => row.status === "active") ?? null;
  const latest = rows[0] ?? null;

  return {
    paymentMode,
    shippingMode,
    paymentFeePercent,
    shippingMarkupPercent,
    connectedAccountRef: active?.account_ref ?? latest?.account_ref ?? null,
    connectedAccountStatus: active?.status ?? latest?.status ?? null,
  };
}

function buildPaymentIntentData(settings: TenantCheckoutSettings, amountTotalCents: number): CheckoutPaymentIntentData | undefined {
  if (!settings.connectedAccountRef) {
    if (settings.paymentMode === "external") {
      throw new Error("External payments mode requires a connected Stripe account. Complete onboarding in Admin > Settings.");
    }
    return undefined;
  }

  if (settings.paymentMode === "external") {
    if (settings.connectedAccountStatus !== "active") {
      throw new Error("External payments mode requires an active Stripe Connect account.");
    }

    return { transfer_data: { destination: settings.connectedAccountRef } };
  }

  if (settings.connectedAccountStatus !== "active") return undefined;

  const applicationFeeAmount = Math.max(0, Math.min(amountTotalCents, Math.round((amountTotalCents * settings.paymentFeePercent) / 100)));

  return {
    transfer_data: { destination: settings.connectedAccountRef },
    ...(applicationFeeAmount > 0 ? { application_fee_amount: applicationFeeAmount } : {}),
  };
}

function chunkArray<T>(arr: T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < arr.length; i += size) chunks.push(arr.slice(i, i + size));
  return chunks;
}

async function fetchProductsByPrintifyIds(productIds: string[]): Promise<DbProduct[]> {
  const db = getFirebaseAdminDb();
  const chunks = chunkArray(productIds, 10);
  const all: DbProduct[] = [];

  for (const ids of chunks) {
    const snap = await db.collection("products").where("printify_id", "in", ids).get();
    for (const doc of snap.docs) {
      all.push(doc.data() as DbProduct);
    }
  }

  return all;
}

async function validateAndHydrateCartItems(items: CartItem[]): Promise<{ tenantId: string; items: ValidatedCartItem[] }> {
  const invalid = items.find((item) => !Number.isInteger(item.quantity) || item.quantity <= 0 || item.unitPrice < 0);
  if (invalid) throw new Error(`Invalid cart item: ${invalid.id}`);

  const productIds = Array.from(new Set(items.map((item) => item.printifyProductId?.trim()).filter(Boolean))) as string[];
  if (!productIds.length) throw new Error("Cart items are missing Printify product IDs.");

  const products = await fetchProductsByPrintifyIds(productIds);
  const productsById = new Map(products.map((product) => [product.printify_id, product]));

  const validatedItems: ValidatedCartItem[] = items.map((item) => {
    const printifyProductId = item.printifyProductId?.trim();
    if (!printifyProductId) throw new Error("Cart contains an item without printifyProductId.");

    const product = productsById.get(printifyProductId);
    if (!product) throw new Error(`Product ${printifyProductId} is no longer available.`);

    const parsedVariants = normalizeVariants(product.variants);
    let unitPrice = Number(product.price ?? 0);

    if (item.printifyVariantId !== undefined && item.printifyVariantId !== null) {
      const fromVariant = variantPriceDollars(parsedVariants, item.printifyVariantId);
      if (fromVariant === null) throw new Error(`Variant ${item.printifyVariantId} for product ${printifyProductId} is not available.`);
      unitPrice = fromVariant;
    }

    if (!Number.isFinite(unitPrice) || unitPrice < 0) {
      throw new Error(`Server-side price for ${printifyProductId} is invalid.`);
    }

    const variantTitle = item.printifyVariantId !== undefined ? parsedVariants.find((variant) => variant.id === item.printifyVariantId)?.title : undefined;

    return {
      ...item,
      printifyProductId,
      name: variantTitle ? `${product.title} (${variantTitle})` : product.title,
      unitPrice: Number(unitPrice.toFixed(2)),
      imageUrl: product.image_url,
    };
  });

  const tenantIds = Array.from(
    new Set(
      validatedItems
        .map((item) => productsById.get(item.printifyProductId)?.tenant_id)
        .filter((tenantId): tenantId is string => Boolean(tenantId)),
    ),
  );

  if (tenantIds.length !== 1) throw new Error("Cart must contain products from exactly one tenant.");
  return { tenantId: tenantIds[0], items: validatedItems };
}

export async function createEmbeddedCheckoutSession(input: CreateEmbeddedCheckoutInput) {
  if (!input.items?.length) throw new Error("Cart is empty.");

  const { tenantId, items } = await validateAndHydrateCartItems(input.items);
  const checkoutSettings = await resolveTenantCheckoutSettings(tenantId);

  const orderId = randomUUID();
  const subtotal = items.reduce((sum, item) => sum + item.unitPrice * item.quantity, 0);
  const amountTotalCents = items.reduce((sum, item) => sum + Math.round(item.unitPrice * 100) * item.quantity, 0);
  const edgePaymentFee = computeEdgePaymentFee(subtotal, checkoutSettings.paymentMode, checkoutSettings.paymentFeePercent);
  const totalPaid = Number(subtotal.toFixed(2));
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";

  const db = getFirebaseAdminDb();
  await db.collection("orders").doc(orderId).set(
    {
      id: orderId,
      tenant_id: tenantId,
      status: "Pending",
      cart_items: items,
      amount_total: totalPaid,
      subtotal: Number(subtotal.toFixed(2)),
      edge_payment_fee: edgePaymentFee,
      shipping_base_cost: 0,
      shipping_markup: 0,
      total_paid: totalPaid,
      currency: "usd",
      customer_email: input.customerEmail ?? null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    },
    { merge: true },
  );

  const stripe = getStripe();
  const sessionParams: CheckoutSessionCreateParams = {
    mode: "payment",
    ui_mode: "embedded_page",
    return_url: `${appUrl}/checkout/return?session_id={CHECKOUT_SESSION_ID}`,
    line_items: items.map(toStripeLineItem),
    shipping_address_collection: { allowed_countries: ["US", "CA"] },
    billing_address_collection: "required",
    metadata: {
      order_id: orderId,
      tenant_id: tenantId,
      payment_mode: checkoutSettings.paymentMode,
      shipping_mode: checkoutSettings.shippingMode,
      payment_fee_percent: String(checkoutSettings.paymentFeePercent),
      shipping_markup_percent: String(checkoutSettings.shippingMarkupPercent),
      connected_account_ref: checkoutSettings.connectedAccountRef ?? "",
    },
  };

  const paymentIntentData = buildPaymentIntentData(checkoutSettings, amountTotalCents);
  if (paymentIntentData) sessionParams.payment_intent_data = paymentIntentData;

  const session = await stripe.checkout.sessions.create(sessionParams);
  if (!session.client_secret) throw new Error("Stripe session did not return a client secret.");

  await db.collection("orders").doc(orderId).set({ stripe_session_id: session.id, updated_at: new Date().toISOString() }, { merge: true });

  return { clientSecret: session.client_secret, sessionId: session.id, orderId };
}
