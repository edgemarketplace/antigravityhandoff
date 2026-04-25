export const FREE_PLAN_FEE_PERCENT = 0.05;
export const GROWTH_PLAN_PRICE_CENTS = 14_900;

type NudgeLevel = "none" | "soft" | "strong" | "urgent";

export type FeeNudge = {
  level: NudgeLevel;
  title: string;
  body: string;
};

export function centsToUsd(cents: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 2,
  }).format((Number.isFinite(cents) ? cents : 0) / 100);
}

export function getFeeNudge(monthlyFeeCents: number): FeeNudge {
  if (monthlyFeeCents >= 15_000) {
    return {
      level: "urgent",
      title: "You’re losing profit",
      body: "You’ve paid over $150 in fees this month. Upgrading now immediately improves margins.",
    };
  }

  if (monthlyFeeCents >= 10_000) {
    return {
      level: "strong",
      title: "You’re close to saving money",
      body: "You’ve paid over $100 in fees this month. Growth ($149/month) will likely lower your total payment cost.",
    };
  }

  if (monthlyFeeCents >= 5_000) {
    return {
      level: "soft",
      title: "You’re growing 🚀",
      body: "You’ve paid over $50 in fees this month. At this pace, upgrading soon helps you keep more revenue.",
    };
  }

  return {
    level: "none",
    title: "Keep scaling",
    body: "As volume increases, this card will show exactly when Growth becomes cheaper than 5% fees.",
  };
}

export function getGrowthPlanComparison(monthlyFeeCents: number) {
  const diff = monthlyFeeCents - GROWTH_PLAN_PRICE_CENTS;

  if (diff > 0) {
    return `On Growth Plan: you'd save ${centsToUsd(diff)} this month and keep 100% of order revenue.`;
  }

  if (diff === 0) {
    return "On Growth Plan: you'd break even at $149 this month and keep 100% of order revenue.";
  }

  return `On Growth Plan: you'd pay ${centsToUsd(Math.abs(diff))} more this month, but fees stop scaling with volume.`;
}

export function getProjectedFreePlanFee(monthlyGmvCents: number): number {
  return Math.max(0, Math.round(monthlyGmvCents * FREE_PLAN_FEE_PERCENT));
}
