import { computeShippingCosts, normalizePercent, type ShippingMode } from "@/lib/monetization";

type ShippoRate = {
  object_id: string;
  provider: string;
  servicelevel?: { name?: string; token?: string };
  amount: string;
  currency: string;
  estimated_days?: number | null;
  duration_terms?: string;
};

type ShippoRateResponse = {
  status: string;
  rates?: ShippoRate[];
};

type ShippoTransactionResponse = {
  object_id: string;
  status: string;
  tracking_number?: string;
  tracking_url_provider?: string;
  label_url?: string;
  messages?: Array<{ code?: string; text?: string }>;
};

export type ShippingQuote = {
  id: string;
  provider: string;
  service: string;
  etaDays: number | null;
  category: "cheapest" | "fastest" | "best_value";
  base_rate: number;
  markup_amount: number;
  final_rate: number;
  currency: string;
};

function getShippoApiKey(): string {
  const key = process.env.SHIPPO_API_KEY;
  if (!key) throw new Error("SHIPPO_API_KEY is missing.");
  return key;
}

export async function fetchShippoRates(shipmentId: string): Promise<ShippoRate[]> {
  const apiKey = getShippoApiKey();
  const response = await fetch(`https://api.goshippo.com/shipments/${shipmentId}/rates/`, {
    method: "GET",
    headers: {
      Authorization: `ShippoToken ${apiKey}`,
      "Content-Type": "application/json",
    },
    cache: "no-store",
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Shippo rates fetch failed (${response.status}): ${body}`);
  }

  const data = (await response.json()) as ShippoRateResponse;
  return data.rates ?? [];
}

function toMoney(amount: string): number {
  const parsed = Number(amount);
  if (!Number.isFinite(parsed) || parsed < 0) return 0;
  return Number(parsed.toFixed(2));
}

export function selectShippingQuotes(params: {
  rates: ShippoRate[];
  shippingMode: ShippingMode;
  shippingMarkupPercent: number;
}): ShippingQuote[] {
  const markupPercent = normalizePercent(params.shippingMarkupPercent, 10);

  const normalized = params.rates
    .map((rate) => {
      const baseRate = toMoney(rate.amount);
      const priced = computeShippingCosts(baseRate, params.shippingMode, markupPercent);
      return {
        id: rate.object_id,
        provider: rate.provider,
        service: rate.servicelevel?.name ?? rate.servicelevel?.token ?? "Standard",
        etaDays: typeof rate.estimated_days === "number" ? rate.estimated_days : null,
        currency: rate.currency || "USD",
        base_rate: priced.baseRate,
        markup_amount: priced.markupAmount,
        final_rate: priced.finalRate,
      };
    })
    .filter((rate) => rate.final_rate > 0);

  if (!normalized.length) return [];

  const byPrice = [...normalized].sort((a, b) => a.final_rate - b.final_rate);
  const bySpeed = [...normalized].sort((a, b) => (a.etaDays ?? 999) - (b.etaDays ?? 999) || a.final_rate - b.final_rate);
  const byValue = [...normalized].sort((a, b) => {
    const aScore = a.final_rate + (a.etaDays ?? 7) * 0.5;
    const bScore = b.final_rate + (b.etaDays ?? 7) * 0.5;
    return aScore - bScore;
  });

  const picks = [
    { ...byPrice[0], category: "cheapest" as const },
    { ...bySpeed[0], category: "fastest" as const },
    { ...byValue[0], category: "best_value" as const },
  ];

  const unique: ShippingQuote[] = [];
  const seen = new Set<string>();
  for (const pick of picks) {
    if (seen.has(pick.id)) continue;
    seen.add(pick.id);
    unique.push(pick);
  }
  return unique;
}

export async function createShippoLabel(rateId: string) {
  const apiKey = getShippoApiKey();

  const response = await fetch("https://api.goshippo.com/transactions/", {
    method: "POST",
    headers: {
      Authorization: `ShippoToken ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      rate: rateId,
      label_file_type: "PDF",
      async: false,
    }),
    cache: "no-store",
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Shippo label creation failed (${response.status}): ${body}`);
  }

  const data = (await response.json()) as ShippoTransactionResponse;
  if (data.status !== "SUCCESS") {
    const message = data.messages?.map((msg) => msg.text).filter(Boolean).join("; ") ?? "Unknown Shippo error";
    throw new Error(`Shippo transaction failed: ${message}`);
  }

  return {
    transactionId: data.object_id,
    trackingNumber: data.tracking_number ?? null,
    trackingUrl: data.tracking_url_provider ?? null,
    labelUrl: data.label_url ?? null,
  };
}
