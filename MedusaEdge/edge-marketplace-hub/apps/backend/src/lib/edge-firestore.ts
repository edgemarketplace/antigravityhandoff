import { randomUUID } from "node:crypto"
import { getFirestoreAdmin } from "./firebase-admin"
import {
  DEFAULT_ONBOARDING_CHECKLIST,
  DISALLOWED_SUBDOMAIN_TOKENS,
  ONBOARDING_STEP_ORDER,
  PLAN_FEE_POLICY,
  RESERVED_SUBDOMAINS,
} from "../modules/onboarding/constants"
import { OnboardingChecklist, OnboardingProgress, OnboardingStep, PlanType, StoreStatus } from "../modules/onboarding/types"

type OnboardingRecord = {
  id: string
  store_name: string
  owner_name: string | null
  email: string | null
  subdomain: string
  status: StoreStatus
  storefront_url: string
  created_at: string
  plan_type: PlanType
  fee_policy: {
    transaction_fee_bps: number
    subscription_price_cents: number
  }
  onboarding_checklist: OnboardingChecklist
  onboarding_progress: OnboardingProgress
  referral_code: string | null
  campaign_source: string | null
}

type ProductRecord = {
  id: string
  tenant_subdomain: string
  title: string
  handle: string
  thumbnail: string | null
  price_cents: number
  currency_code: string
  created_at: string
}

export function getEdgeCollections() {
  const db = getFirestoreAdmin()

  return {
    db,
    onboarding: db.collection("edge_tenant_onboarding"),
    subdomains: db.collection("edge_tenant_subdomains"),
    products: db.collection("edge_tenant_products"),
  }
}

export function slugifyStoreName(input: string) {
  const base = input
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")

  return base || `store-${Date.now().toString().slice(-6)}`
}

export function validateSubdomain(rawInput: string) {
  const candidate = slugifyStoreName(rawInput)

  if (candidate.length < 3 || candidate.length > 63) {
    return { ok: false, reason: "subdomain length must be 3-63 chars", normalized: candidate }
  }

  if (RESERVED_SUBDOMAINS.has(candidate)) {
    return { ok: false, reason: "subdomain is reserved", normalized: candidate }
  }

  if (DISALLOWED_SUBDOMAIN_TOKENS.some((token) => candidate.includes(token))) {
    return { ok: false, reason: "subdomain contains blocked token", normalized: candidate }
  }

  return { ok: true, normalized: candidate }
}

async function reserveSubdomain(candidate: string, onboardingId: string) {
  const { db, subdomains } = getEdgeCollections()
  const ref = subdomains.doc(candidate)

  return db.runTransaction(async (tx) => {
    const snap = await tx.get(ref)

    if (snap.exists) {
      return false
    }

    tx.set(ref, {
      onboarding_id: onboardingId,
      created_at: new Date().toISOString(),
    })

    return true
  })
}

export async function nextAvailableSubdomain(base: string, onboardingId: string) {
  let candidate = base
  let suffix = 1

  while (true) {
    const ok = await reserveSubdomain(candidate, onboardingId)
    if (ok) return candidate

    suffix += 1
    candidate = `${base}-${suffix}`
  }
}

export async function checkSubdomainAvailability(rawInput: string) {
  const validity = validateSubdomain(rawInput)
  if (!validity.ok) {
    return { available: false, normalized: validity.normalized, reason: validity.reason }
  }

  const { subdomains } = getEdgeCollections()
  const doc = await subdomains.doc(validity.normalized).get()

  return {
    available: !doc.exists,
    normalized: validity.normalized,
    reason: doc.exists ? "subdomain already in use" : null,
  }
}

export async function reserveRequestedSubdomain(rawInput: string, onboardingId: string) {
  const validity = validateSubdomain(rawInput)
  if (!validity.ok) {
    return { ok: false, normalized: validity.normalized, reason: validity.reason }
  }

  const reserved = await reserveSubdomain(validity.normalized, onboardingId)
  if (!reserved) {
    return { ok: false, normalized: validity.normalized, reason: "subdomain already in use" }
  }

  return { ok: true, normalized: validity.normalized as string }
}

export async function createOnboardingRecord(input: {
  storeName: string
  ownerName?: string
  email?: string
  localRootHost: string
  planType?: PlanType
  referralCode?: string
  campaignSource?: string
}) {
  const { onboarding } = getEdgeCollections()

  const id = randomUUID()
  const baseSubdomain = slugifyStoreName(input.storeName)
  const subdomain = await nextAvailableSubdomain(baseSubdomain, id)
  const createdAt = new Date().toISOString()
  const storefrontUrl = `http://${subdomain}.${input.localRootHost}:8000/us`
  const planType = input.planType || "free"

  const record: OnboardingRecord = {
    id,
    store_name: input.storeName,
    owner_name: input.ownerName?.trim() || null,
    email: input.email?.trim() || null,
    subdomain,
    status: "onboarding",
    storefront_url: storefrontUrl,
    created_at: createdAt,
    plan_type: planType,
    fee_policy: PLAN_FEE_POLICY[planType],
    onboarding_checklist: { ...DEFAULT_ONBOARDING_CHECKLIST },
    onboarding_progress: {
      completed_steps: [],
      current_step: ONBOARDING_STEP_ORDER[0],
    },
    referral_code: input.referralCode?.trim() || null,
    campaign_source: input.campaignSource?.trim() || null,
  }

  await onboarding.doc(id).set(record)

  return record
}

export async function setOnboardingPlan(params: { onboardingId: string; planType: PlanType }) {
  const { onboarding } = getEdgeCollections()
  const ref = onboarding.doc(params.onboardingId)
  const snap = await ref.get()

  if (!snap.exists) {
    return null
  }

  const nextFeePolicy = PLAN_FEE_POLICY[params.planType]

  await ref.update({
    plan_type: params.planType,
    fee_policy: nextFeePolicy,
    updated_at: new Date().toISOString(),
  })

  const updated = await ref.get()
  return updated.data() as OnboardingRecord
}

export async function saveOnboardingStep(params: {
  onboardingId: string
  step: OnboardingStep
  completed?: boolean
  payload?: Record<string, unknown>
}) {
  const { onboarding } = getEdgeCollections()
  const ref = onboarding.doc(params.onboardingId)
  const snap = await ref.get()

  if (!snap.exists) {
    return null
  }

  const current = snap.data() as OnboardingRecord
  const currentProgress = current.onboarding_progress || {
    completed_steps: [],
    current_step: ONBOARDING_STEP_ORDER[0],
  }

  const completedSet = new Set(currentProgress.completed_steps)
  if (params.completed !== false) {
    completedSet.add(params.step)
  }

  const completed_steps = ONBOARDING_STEP_ORDER.filter((step) => completedSet.has(step))
  const stepIndex = ONBOARDING_STEP_ORDER.indexOf(params.step)
  const nextStep = ONBOARDING_STEP_ORDER[Math.min(stepIndex + 1, ONBOARDING_STEP_ORDER.length - 1)]

  const nextProgress: OnboardingProgress = {
    completed_steps,
    current_step: nextStep,
  }

  const existingPayload = ((current as unknown as { onboarding_payload?: Record<string, unknown> }).onboarding_payload || {}) as Record<string, unknown>

  await ref.update({
    onboarding_progress: nextProgress,
    onboarding_payload: {
      ...existingPayload,
      [params.step]: params.payload || {},
    },
    updated_at: new Date().toISOString(),
  })

  const updated = await ref.get()
  return updated.data() as OnboardingRecord
}

function evaluateLaunchReadiness(checklist: OnboardingChecklist) {
  const missing: string[] = []

  if (!checklist.has_product) missing.push("has_product")
  if (!checklist.payments_connected) missing.push("payments_connected")
  if (!checklist.shipping_configured) missing.push("shipping_configured")

  return {
    ready: missing.length === 0,
    missing,
  }
}

export async function setOnboardingChecklistFlags(params: {
  onboardingId: string
  updates: Partial<OnboardingChecklist>
}) {
  const { onboarding } = getEdgeCollections()
  const ref = onboarding.doc(params.onboardingId)
  const snap = await ref.get()

  if (!snap.exists) {
    return null
  }

  const current = snap.data() as OnboardingRecord
  const nextChecklist: OnboardingChecklist = {
    ...DEFAULT_ONBOARDING_CHECKLIST,
    ...(current.onboarding_checklist || {}),
    ...params.updates,
  }

  const readiness = evaluateLaunchReadiness(nextChecklist)
  const nextStatus: StoreStatus = readiness.ready ? "launch_ready" : "onboarding"

  await ref.update({
    onboarding_checklist: nextChecklist,
    status: nextStatus,
    updated_at: new Date().toISOString(),
  })

  const updated = await ref.get()
  return updated.data() as OnboardingRecord
}

export async function getOnboardingProgress(onboardingId: string) {
  const tenant = await getOnboardingById(onboardingId)
  if (!tenant) {
    return null
  }

  const readiness = evaluateLaunchReadiness(tenant.onboarding_checklist || DEFAULT_ONBOARDING_CHECKLIST)

  return {
    onboardingId,
    progress: tenant.onboarding_progress,
    checklist: tenant.onboarding_checklist,
    status: tenant.status,
    nextStep: tenant.onboarding_progress?.current_step || ONBOARDING_STEP_ORDER[0],
    readiness,
  }
}

export async function getLaunchReadiness(onboardingId: string) {
  const tenant = await getOnboardingById(onboardingId)
  if (!tenant) {
    return null
  }

  const readiness = evaluateLaunchReadiness(tenant.onboarding_checklist || DEFAULT_ONBOARDING_CHECKLIST)

  return {
    onboardingId,
    status: tenant.status,
    checklist: tenant.onboarding_checklist,
    readiness,
  }
}

export async function launchOnboardingStore(onboardingId: string) {
  const { onboarding } = getEdgeCollections()
  const ref = onboarding.doc(onboardingId)
  const snap = await ref.get()

  if (!snap.exists) {
    return { ok: false as const, reason: "onboarding record not found" }
  }

  const tenant = snap.data() as OnboardingRecord
  const checklist: OnboardingChecklist = {
    ...DEFAULT_ONBOARDING_CHECKLIST,
    ...(tenant.onboarding_checklist || {}),
  }

  const readiness = evaluateLaunchReadiness(checklist)
  if (!readiness.ready) {
    return { ok: false as const, reason: "launch requirements not met", missing: readiness.missing }
  }

  const nextChecklist: OnboardingChecklist = {
    ...checklist,
    storefront_published: true,
  }

  await ref.update({
    status: "live",
    onboarding_checklist: nextChecklist,
    updated_at: new Date().toISOString(),
    launched_at: new Date().toISOString(),
  })

  const updated = await ref.get()
  return { ok: true as const, tenant: updated.data() as OnboardingRecord }
}

export async function getOnboardingBySubdomain(subdomain: string) {
  const { onboarding } = getEdgeCollections()
  const snap = await onboarding.where("subdomain", "==", subdomain).limit(1).get()
  if (snap.empty) return null
  return snap.docs[0].data() as OnboardingRecord
}

export async function getOnboardingById(id: string) {
  const { onboarding } = getEdgeCollections()
  const doc = await onboarding.doc(id).get()
  if (!doc.exists) return null
  return doc.data() as OnboardingRecord
}

export async function listRecentOnboarding(limit = 25) {
  const { onboarding } = getEdgeCollections()
  const snap = await onboarding.orderBy("created_at", "desc").limit(limit).get()
  return snap.docs.map((d) => d.data() as OnboardingRecord)
}

export async function listProductsByTenant(params: { tenant: string; limit: number; offset: number }) {
  const { products } = getEdgeCollections()

  const [itemsSnap, countSnap] = await Promise.all([
    products.where("tenant_subdomain", "==", params.tenant).get(),
    products.where("tenant_subdomain", "==", params.tenant).count().get(),
  ])

  const allItems = itemsSnap.docs.map((d) => d.data() as ProductRecord)
  allItems.sort((a, b) => (a.created_at < b.created_at ? 1 : -1))

  const items = allItems.slice(params.offset, params.offset + params.limit)
  const count = countSnap.data().count || 0

  return { items, count }
}
