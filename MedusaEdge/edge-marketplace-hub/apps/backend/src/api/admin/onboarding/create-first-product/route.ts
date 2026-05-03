import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { setOnboardingChecklistFlags } from "../../../../lib/edge-firestore"

type FirstProductPayload = {
  onboardingId?: string
  title?: string
  price?: number
  image?: string
  description?: string
}

export async function POST(req: MedusaRequest, res: MedusaResponse) {
  const body = (req.body || {}) as FirstProductPayload
  const onboardingId = body.onboardingId?.trim() || ""

  if (!onboardingId || !body.title || !body.price) {
    return res.status(400).json({ ok: false, error: "onboardingId, title, and price are required" })
  }

  const updated = await setOnboardingChecklistFlags({
    onboardingId,
    updates: { has_product: true },
  })

  if (!updated) {
    return res.status(404).json({ ok: false, error: "onboarding record not found" })
  }

  return res.status(200).json({
    ok: true,
    has_product: true,
    onboardingId,
    status: updated.status,
    checklist: updated.onboarding_checklist,
  })
}
