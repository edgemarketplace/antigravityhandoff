import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { setOnboardingChecklistFlags } from "../../../../lib/edge-firestore"

type ConnectStripePayload = {
  onboardingId?: string
  stripeConnectedAccountId?: string
}

export async function POST(req: MedusaRequest, res: MedusaResponse) {
  const body = (req.body || {}) as ConnectStripePayload
  const onboardingId = body.onboardingId?.trim() || ""

  if (!onboardingId) {
    return res.status(400).json({ ok: false, error: "onboardingId is required" })
  }

  const updated = await setOnboardingChecklistFlags({
    onboardingId,
    updates: { payments_connected: true },
  })

  if (!updated) {
    return res.status(404).json({ ok: false, error: "onboarding record not found" })
  }

  return res.status(200).json({
    ok: true,
    onboardingId,
    payments_connected: true,
    stripe_connected_account_id: body.stripeConnectedAccountId || null,
    status: updated.status,
    checklist: updated.onboarding_checklist,
  })
}
