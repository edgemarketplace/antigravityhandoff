export type PlanType = "free" | "paid"

export type OnboardingStep =
  | "plan"
  | "store_basics"
  | "business_identity"
  | "template"
  | "branding"
  | "first_product"
  | "payments"
  | "shipping"
  | "review"

export type StoreStatus = "onboarding" | "launch_ready" | "live"

export type OnboardingChecklist = {
  has_product: boolean
  payments_connected: boolean
  shipping_configured: boolean
  storefront_published: boolean
}

export type FeePolicy = {
  transaction_fee_bps: number
  subscription_price_cents: number
}

export type OnboardingProgress = {
  completed_steps: OnboardingStep[]
  current_step: OnboardingStep
}
