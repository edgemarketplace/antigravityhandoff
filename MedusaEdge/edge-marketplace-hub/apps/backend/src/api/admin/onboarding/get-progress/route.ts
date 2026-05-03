import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { getOnboardingProgress } from "../../../../lib/edge-firestore"

export async function GET(req: MedusaRequest, res: MedusaResponse) {
  const onboardingId = (req.query.onboardingId as string | undefined)?.trim() || ""

  if (!onboardingId) {
    return res.status(400).json({ ok: false, error: "onboardingId is required" })
  }

  const progress = await getOnboardingProgress(onboardingId)

  if (!progress) {
    return res.status(404).json({ ok: false, error: "onboarding record not found" })
  }

  return res.status(200).json({
    ok: true,
    ...progress,
  })
}
