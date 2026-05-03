import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { reserveRequestedSubdomain } from "../../../../lib/edge-firestore"

type ReserveSubdomainPayload = {
  subdomain?: string
  onboardingId?: string
}

export async function POST(req: MedusaRequest, res: MedusaResponse) {
  const body = (req.body || {}) as ReserveSubdomainPayload
  const subdomain = body.subdomain?.trim() || ""
  const onboardingId = body.onboardingId?.trim() || ""

  if (!subdomain || !onboardingId) {
    return res.status(400).json({ ok: false, error: "subdomain and onboardingId are required" })
  }

  const result = await reserveRequestedSubdomain(subdomain, onboardingId)

  if (!result.ok) {
    return res.status(409).json({
      ok: false,
      normalized: result.normalized,
      reason: result.reason,
    })
  }

  return res.status(201).json({
    ok: true,
    normalized: result.normalized,
  })
}
