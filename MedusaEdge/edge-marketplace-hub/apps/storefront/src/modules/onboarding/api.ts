export type PlanType = "free" | "paid"

const backendUrl = process.env.NEXT_PUBLIC_MEDUSA_BACKEND_URL || "http://localhost:9000"

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${backendUrl}${path}`, {
    ...init,
    headers: {
      "content-type": "application/json",
      ...(init?.headers || {}),
    },
  })

  const data = (await res.json()) as T
  return data
}

export async function createOnboarding(input: {
  storeName: string
  ownerName?: string
  email?: string
  planType: PlanType
  referralCode?: string
  campaignSource?: string
}) {
  return request<{ ok: boolean; tenant?: { id: string; status: string; subdomain: string; storefront_url: string }; error?: string }>(
    "/store/edge/onboarding",
    { method: "POST", body: JSON.stringify(input) }
  )
}

export async function checkSubdomain(subdomain: string) {
  return request<{ ok: boolean; available: boolean; normalized: string; reason?: string }>(
    "/admin/stores/check-subdomain",
    { method: "POST", body: JSON.stringify({ subdomain }) }
  )
}

export async function reserveSubdomain(onboardingId: string, subdomain: string) {
  return request<{ ok: boolean; normalized?: string; reason?: string }>(
    "/admin/stores/reserve-subdomain",
    { method: "POST", body: JSON.stringify({ onboardingId, subdomain }) }
  )
}

export async function selectPlan(onboardingId: string, planType: PlanType) {
  return request<{ ok: boolean; feePolicy?: { transaction_fee_bps: number; subscription_price_cents: number } }>(
    "/admin/onboarding/select-plan",
    { method: "POST", body: JSON.stringify({ onboardingId, planType }) }
  )
}

export async function saveStep(onboardingId: string, step: string, payload?: Record<string, unknown>) {
  return request<{ ok: boolean }>("/admin/onboarding/save-step", {
    method: "POST",
    body: JSON.stringify({ onboardingId, step, payload }),
  })
}

export async function createFirstProduct(onboardingId: string, title: string, price: number) {
  return request<{ ok: boolean }>("/admin/onboarding/create-first-product", {
    method: "POST",
    body: JSON.stringify({ onboardingId, title, price }),
  })
}

export async function saveShipping(onboardingId: string, shippingMode: "flat" | "free" | "manual" | "printify") {
  return request<{ ok: boolean }>("/admin/onboarding/save-shipping", {
    method: "POST",
    body: JSON.stringify({ onboardingId, shippingMode }),
  })
}

export async function connectStripe(onboardingId: string) {
  return request<{ ok: boolean }>("/admin/onboarding/connect-stripe", {
    method: "POST",
    body: JSON.stringify({ onboardingId }),
  })
}

export async function launchReadiness(onboardingId: string) {
  return request<{ ok: boolean; readiness?: { ready: boolean; missing: string[] } }>(
    `/admin/onboarding/launch-readiness?onboardingId=${encodeURIComponent(onboardingId)}`
  )
}

export async function launchStore(onboardingId: string) {
  return request<{ ok: boolean; reason?: string; missing?: string[] }>("/admin/onboarding/launch", {
    method: "POST",
    body: JSON.stringify({ onboardingId }),
  })
}
