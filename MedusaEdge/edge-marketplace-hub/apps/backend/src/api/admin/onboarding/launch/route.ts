import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { launchOnboardingStore } from "../../../../lib/edge-firestore"

type LaunchPayload = {
  onboardingId?: string
}

export async function POST(req: MedusaRequest, res: MedusaResponse) {
  const body = (req.body || {}) as LaunchPayload
  const onboardingId = body.onboardingId?.trim() || ""

  if (!onboardingId) {
    return res.status(400).json({ ok: false, error: "onboardingId is required" })
  }

  const result = await launchOnboardingStore(onboardingId)

  if (!result.ok) {
    const status = result.reason === "onboarding record not found" ? 404 : 409
    return res.status(status).json({ ok: false, reason: result.reason, missing: (result as { missing?: string[] }).missing || [] })
  }

  return res.status(200).json({ ok: true, tenant: result.tenant })
}
