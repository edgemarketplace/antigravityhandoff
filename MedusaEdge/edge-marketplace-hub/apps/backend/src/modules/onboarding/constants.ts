import { FeePolicy, OnboardingChecklist, OnboardingStep } from "./types"

export const RESERVED_SUBDOMAINS = new Set(["admin", "api", "app", "www"])

export const DISALLOWED_SUBDOMAIN_TOKENS = [
  "fuck",
  "shit",
  "bitch",
  "asshole",
  "cunt",
  "nigger",
  "faggot",
  "porn",
  "sex",
]

export const PLAN_FEE_POLICY: Record<"free" | "paid", FeePolicy> = {
  free: {
    transaction_fee_bps: 500,
    subscription_price_cents: 0,
  },
  paid: {
    transaction_fee_bps: 50,
    subscription_price_cents: 9900,
  },
}

export const ONBOARDING_STEP_ORDER: OnboardingStep[] = [
  "plan",
  "store_basics",
  "business_identity",
  "template",
  "branding",
  "first_product",
  "payments",
  "shipping",
  "review",
]

export const DEFAULT_ONBOARDING_CHECKLIST: OnboardingChecklist = {
  has_product: false,
  payments_connected: false,
  shipping_configured: false,
  storefront_published: false,
}
