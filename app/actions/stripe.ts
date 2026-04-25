"use server";

import { randomUUID } from "node:crypto";
import { getStripe } from "@/lib/stripe";
import { getSupabaseAdminClient } from "@/lib/supabase-admin";
import type { CartItem } from "@/stores/cart";

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

type TenantPaymentMode = "edge_payments" | "byo_stripe";

type TenantPaymentSettings = {
  paymentMode: TenantPaymentMode;
  applicationFeePercent: number;
  connectedAccountRef: string | null;
  connectedAccountStatus: string | null;
};

type PaymentAccountRow = {
  account_ref: string;
  status: string;
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

    const candidate = row as {
      id?: unknown;
      title?: unknown;
      price?: unknown;
      is_enabled?: unknown;
    };

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

function normalizePaymentMode(value: unknown): TenantPaymentMode {
  return value === "byo_stripe" ? "byo_stripe" : "edge_payments";
}

function normalizeApplicationFeePercent(value: unknown): number {
  const parsed = typeof value === "number" ? value : Number(value ?? 0);
  if (!Number.isFinite(parsed)) return 0;
  if (parsed <= 0) return 0;
  if (parsed >= 100) return 100;
  return Number(parsed.toFixed(2));
}

async function resolveTenantPaymentSettings(tenantId: string): Promise<TenantPaymentSettings> {
  const supabase = getSupabaseAdminClient();

  const { data: tenant, error: tenantError } = await supabase
    .from("tenants")
    .select("payment_mode,payment_application_fee_percent")
    .eq("id", tenantId)
    .maybeSingle();

  if (tenantError || !tenant) {
    throw new Error(`Could not resolve tenant payment settings: ${tenantError?.message ?? "tenant not found"}`);
  }

  const paymentMode = normalizePaymentMode(tenant.payment_mode);
  const applicationFeePercent = normalizeApplicationFeePercent(tenant.payment_application_fee_percent);

  const { data: accounts, error: accountError } = await supabase
    .from("payment_accounts")
    .select("account_ref,status")
    .eq("tenant_id", tenantId)
    .eq("provider", "stripe_connect")
    .order("created_at", { ascending: false })
    .limit(5);

  if (accountError) {
    throw new Error(`Could not resolve tenant payment account: ${accountError.message}`);
  }

  const rows = ((accounts ?? []) as PaymentAccountRow[]).filter((row) => Boolean(row.account_ref));
  const active = rows.find((row) => row.status === "active") ?? null;
  const latest = rows[0] ?? null;

  return {
    paymentMode,
    applicationFeePercent,
    connectedAccountRef: active?.account_ref ?? latest?.account_ref ?? null,
    connectedAccountStatus: active?.status ?? latest?.status ?? null,
  };
}

function buildPaymentIntentData(
  settings: TenantPaymentSettings,
  amountTotalCents: number,
): CheckoutPaymentIntentData | undefined {
  if (!settings.connectedAccountRef) {
    if (settings.paymentMode === "byo_stripe") {
      throw new Error("BYO Stripe mode requires a connected Stripe account. Complete onboarding in Admin > Settings.");
    }

    return undefined;
  }

  if (settings.paymentMode === "byo_stripe") {
    if (settings.connectedAccountStatus !== "active") {
      throw new Error("BYO Stripe mode requires an active Stripe Connect account.");
    }

    return {
      transfer_data: {
        destination: settings.connectedAccountRef,
      },
    };
  }

  if (settings.connectedAccountStatus !== "active") {
    return undefined;
  }

  const applicationFeeAmount = Math.max(
    0,
    Math.min(amountTotalCents, Math.round((amountTotalCents * settings.applicationFeePercent) / 100)),
  );

  return {
    transfer_data: {
      destination: settings.connectedAccountRef,
    },
    ...(applicationFeeAmount > 0 ? { application_fee_amount: applicationFeeAmount } : {}),
  };
}

async function validateAndHydrateCartItems(items: CartItem[]): Promise<{ tenantId: string; items: ValidatedCartItem[] }> {
  const invalid = items.find((item) => !Number.isInteger(item.quantity) || item.quantity <= 0 || item.unitPrice < 0);
  if (invalid) {
    throw new Error(`Invalid cart item: ${invalid.id}`);
  }

  const productIds = Array.from(new Set(items.map((item) => item.printifyProductId?.trim()).filter(Boolean))) as string[];

  if (!productIds.length) {
    throw new Error("Cart items are missing Printify product IDs.");
  }

  const supabase = getSupabaseAdminClient();
  const { data, error } = await supabase
    .from("products")
    .select("tenant_id,printify_id,title,price,image_url,variants")
    .in("printify_id", productIds);

  if (error) {
    throw new Error(`Could not validate cart products: ${error.message}`);
  }

  const products = (data ?? []) as DbProduct[];
  const productsById = new Map(products.map((product) => [product.printify_id, product]));

  const validatedItems: ValidatedCartItem[] = items.map((item) => {
    const printifyProductId = item.printifyProductId?.trim();

    if (!printifyProductId) {
      throw new Error("Cart contains an item without printifyProductId.");
    }

    const product = productsById.get(printifyProductId);
    if (!product) {
      throw new Error(`Product ${printifyProductId} is no longer available.`);
    }

    const parsedVariants = normalizeVariants(product.variants);
    let unitPrice = Number(product.price ?? 0);

    if (item.printifyVariantId !== undefined && item.printifyVariantId !== null) {
      const fromVariant = variantPriceDollars(parsedVariants, item.printifyVariantId);
      if (fromVariant === null) {
        throw new Error(`Variant ${item.printifyVariantId} for product ${printifyProductId} is not available.`);
      }
      unitPrice = fromVariant;
    }

    if (!Number.isFinite(unitPrice) || unitPrice < 0) {
      throw new Error(`Server-side price for ${printifyProductId} is invalid.`);
    }

    const variantTitle =
      item.printifyVariantId !== undefined
        ? parsedVariants.find((variant) => variant.id === item.printifyVariantId)?.title
        : undefined;

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

  if (tenantIds.length !== 1) {
    throw new Error("Cart must contain products from exactly one tenant.");
  }

  return {
    tenantId: tenantIds[0],
    items: validatedItems,
  };
}

export async function createEmbeddedCheckoutSession(input: CreateEmbeddedCheckoutInput) {
  if (!input.items?.length) {
    throw new Error("Cart is empty.");
  }

  const { tenantId, items } = await validateAndHydrateCartItems(input.items);
  const paymentSettings = await resolveTenantPaymentSettings(tenantId);

  const orderId = randomUUID();
  const amountTotal = items.reduce((sum, item) => sum + item.unitPrice * item.quantity, 0);
  const amountTotalCents = items.reduce((sum, item) => sum + Math.round(item.unitPrice * 100) * item.quantity, 0);
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";

  const supabase = getSupabaseAdminClient();
  const { error: orderError } = await supabase.from("orders").upsert(
    {
      id: orderId,
      tenant_id: tenantId,
      status: "Pending",
      cart_items: items,
      amount_total: Number(amountTotal.toFixed(2)),
      currency: "usd",
      customer_email: input.customerEmail ?? null,
    },
    { onConflict: "id" },
  );

  if (orderError) {
    throw new Error(`Could not persist order draft: ${orderError.message}`);
  }

  const stripe = getStripe();

  const sessionParams: CheckoutSessionCreateParams = {
    mode: "payment",
    ui_mode: "embedded_page",
    return_url: `${appUrl}/checkout/return?session_id={CHECKOUT_SESSION_ID}`,
    line_items: items.map(toStripeLineItem),
    shipping_address_collection: {
      allowed_countries: ["US", "CA"],
    },
    billing_address_collection: "required",
    metadata: {
      order_id: orderId,
      tenant_id: tenantId,
      payment_mode: paymentSettings.paymentMode,
      connected_account_ref: paymentSettings.connectedAccountRef ?? "",
    },
  };

  const paymentIntentData = buildPaymentIntentData(paymentSettings, amountTotalCents);
  if (paymentIntentData) {
    sessionParams.payment_intent_data = paymentIntentData;
  }

  const session = await stripe.checkout.sessions.create(sessionParams);

  if (!session.client_secret) {
    throw new Error("Stripe session did not return a client secret.");
  }

  const { error: linkError } = await supabase
    .from("orders")
    .update({ stripe_session_id: session.id })
    .eq("id", orderId);

  if (linkError) {
    throw new Error(`Could not link Stripe session to order: ${linkError.message}`);
  }

  return { clientSecret: session.client_secret, sessionId: session.id, orderId };
}
