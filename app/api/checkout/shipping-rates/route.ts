import { NextResponse } from "next/server";
import { resolveTenantFromRequest } from "@/lib/tenant-context";
import { fetchShippoRates, selectShippingQuotes } from "@/lib/shippo";
import { normalizePercent, normalizeShippingMode } from "@/lib/monetization";

export const dynamic = "force-dynamic";

type ExternalRate = {
  id?: string;
  provider?: string;
  service?: string;
  amount?: number;
  eta_days?: number | null;
  currency?: string;
};

type BodyPayload = {
  shipment_id?: string;
  external_rates?: ExternalRate[];
};

export async function POST(request: Request) {
  const tenant = await resolveTenantFromRequest(request);
  if (!tenant) {
    return NextResponse.json({ success: false, message: "Tenant context not found." }, { status: 400 });
  }

  const body = (await request.json().catch(() => ({}))) as BodyPayload;
  const shippingMode = normalizeShippingMode(tenant.shipping_mode);
  const shippingMarkupPercent = normalizePercent(tenant.shipping_markup_percent, 10);

  if (shippingMode === "external") {
    const rates = (body.external_rates ?? [])
      .map((rate, idx) => {
        const amount = Number(rate.amount ?? 0);
        if (!Number.isFinite(amount) || amount <= 0) return null;
        return {
          id: rate.id ?? `external-${idx + 1}`,
          provider: rate.provider ?? "Merchant Provider",
          service: rate.service ?? `Option ${idx + 1}`,
          etaDays: typeof rate.eta_days === "number" ? rate.eta_days : null,
          category: "best_value" as const,
          base_rate: Number(amount.toFixed(2)),
          markup_amount: 0,
          final_rate: Number(amount.toFixed(2)),
          currency: rate.currency ?? "USD",
        };
      })
      .filter((rate): rate is NonNullable<typeof rate> => Boolean(rate));

    return NextResponse.json({
      success: true,
      shipping_mode: "external",
      shipping_markup_percent: 0,
      quotes: rates,
    });
  }

  if (!body.shipment_id) {
    return NextResponse.json(
      { success: false, message: "shipment_id is required for Edge Shipping quotes." },
      { status: 400 },
    );
  }

  const rates = await fetchShippoRates(body.shipment_id);
  const quotes = selectShippingQuotes({
    rates,
    shippingMode,
    shippingMarkupPercent,
  });

  return NextResponse.json({
    success: true,
    shipping_mode: "edge",
    shipping_markup_percent: shippingMarkupPercent,
    quotes,
  });
}
