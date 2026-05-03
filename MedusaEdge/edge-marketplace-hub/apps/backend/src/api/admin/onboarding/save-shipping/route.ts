import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { setOnboardingChecklistFlags } from "../../../../lib/edge-firestore"

type SaveShippingPayload = {
  onboardingId?: string
  shippingMode?: "flat" | "free" | "manual" | "printify"
  flatRate?: number
}

export async function POST(req: MedusaRequest, res: MedusaResponse) {
  const body = (req.body || {}) as SaveShippingPayload
  const onboardingId = body.onboardingId?.trim() || ""

  if (!onboardingId || !body.shippingMode) {
    return res.status(400).json({ ok: false, error: "onboardingId and shippingMode are required" })
  }

  const updated = await setOnboardingChecklistFlags({
    onboardingId,
    updates: { shipping_configured: true },
  })

  if (!updated) {
    return res.status(404).json({ ok: false, error: "onboarding record not found" })
  }

  return res.status(200).json({
    ok: true,
    shipping_configured: true,
    onboardingId,
    status: updated.status,
    checklist: updated.onboarding_checklist,
  })
}
