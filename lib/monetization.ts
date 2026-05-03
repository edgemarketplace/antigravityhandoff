export type PaymentMode = "edge" | "external";
export type ShippingMode = "edge" | "external";

export function normalizePercent(input: unknown, fallback: number): number {
  const parsed = typeof input === "number" ? input : Number(input ?? fallback);
  if (!Number.isFinite(parsed)) return fallback;
  if (parsed < 0) return 0;
  if (parsed > 100) return 100;
  return Number(parsed.toFixed(2));
}

export function roundMoney(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Number(value.toFixed(2));
}

export function computeEdgePaymentFee(orderTotal: number, paymentMode: PaymentMode, feePercent: number): number {
  if (paymentMode !== "edge") return 0;
  return roundMoney(orderTotal * (feePercent / 100));
}

export function computeShippingCosts(baseRate: number, shippingMode: ShippingMode, markupPercent: number): {
  baseRate: number;
  markupAmount: number;
  finalRate: number;
} {
  const normalizedBase = roundMoney(baseRate);
  if (shippingMode !== "edge") {
    return {
      baseRate: normalizedBase,
      markupAmount: 0,
      finalRate: normalizedBase,
    };
  }

  const markupAmount = roundMoney(normalizedBase * (markupPercent / 100));
  return {
    baseRate: normalizedBase,
    markupAmount,
    finalRate: roundMoney(normalizedBase + markupAmount),
  };
}

export function normalizePaymentMode(value: unknown): PaymentMode {
  if (value === "external" || value === "byo_stripe") return "external";
  return "edge";
}

export function normalizeShippingMode(value: unknown): ShippingMode {
  if (value === "external") return "external";
  return "edge";
}
