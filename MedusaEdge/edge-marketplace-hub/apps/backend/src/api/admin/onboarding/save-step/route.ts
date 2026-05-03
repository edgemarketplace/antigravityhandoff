import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { ONBOARDING_STEP_ORDER } from "../../../../modules/onboarding/constants"
import { saveOnboardingStep } from "../../../../lib/edge-firestore"
import { OnboardingStep } from "../../../../modules/onboarding/types"

type SaveStepPayload = {
  onboardingId?: string
  step?: OnboardingStep
  completed?: boolean
  payload?: Record<string, unknown>
}

function isOnboardingStep(value: string): value is OnboardingStep {
  return ONBOARDING_STEP_ORDER.includes(value as OnboardingStep)
}

export async function POST(req: MedusaRequest, res: MedusaResponse) {
  const body = (req.body || {}) as SaveStepPayload
  const onboardingId = body.onboardingId?.trim() || ""
  const stepRaw = body.step?.trim() || ""

  if (!onboardingId || !isOnboardingStep(stepRaw)) {
    return res.status(400).json({ ok: false, error: "onboardingId and valid step are required" })
  }

  const updated = await saveOnboardingStep({
    onboardingId,
    step: stepRaw,
    completed: body.completed,
    payload: body.payload,
  })

  if (!updated) {
    return res.status(404).json({ ok: false, error: "onboarding record not found" })
  }

  return res.status(200).json({
    ok: true,
    onboardingId,
    progress: updated.onboarding_progress,
    checklist: updated.onboarding_checklist,
    status: updated.status,
  })
}
