import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { setOnboardingPlan } from "../../../../lib/edge-firestore"
import { PLAN_FEE_POLICY } from "../../../../modules/onboarding/constants"
import { PlanType } from "../../../../modules/onboarding/types"

type SelectPlanPayload = {
  onboardingId?: string
  planType?: PlanType
}

function isPlanType(value: string): value is PlanType {
  return value === "free" || value === "paid"
}

export async function POST(req: MedusaRequest, res: MedusaResponse) {
  const body = (req.body || {}) as SelectPlanPayload
  const onboardingId = body.onboardingId?.trim() || ""
  const planTypeRaw = body.planType?.trim() || ""

  if (!onboardingId || !isPlanType(planTypeRaw)) {
    return res.status(400).json({
      ok: false,
      error: "onboardingId and valid planType (free|paid) are required",
    })
  }

  const updated = await setOnboardingPlan({ onboardingId, planType: planTypeRaw })

  if (!updated) {
    return res.status(404).json({ ok: false, error: "onboarding record not found" })
  }

  return res.status(200).json({
    ok: true,
    onboardingId,
    planType: planTypeRaw,
    feePolicy: PLAN_FEE_POLICY[planTypeRaw],
    tenant: updated,
  })
}
