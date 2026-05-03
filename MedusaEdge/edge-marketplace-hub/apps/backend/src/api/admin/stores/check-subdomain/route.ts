import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { checkSubdomainAvailability } from "../../../../lib/edge-firestore"

type CheckSubdomainPayload = {
  subdomain?: string
}

export async function POST(req: MedusaRequest, res: MedusaResponse) {
  const body = (req.body || {}) as CheckSubdomainPayload
  const subdomain = body.subdomain?.trim() || ""

  if (!subdomain) {
    return res.status(400).json({ ok: false, error: "subdomain is required" })
  }

  const result = await checkSubdomainAvailability(subdomain)

  if (!result.available) {
    return res.status(200).json({
      ok: true,
      available: false,
      normalized: result.normalized,
      reason: result.reason,
    })
  }

  return res.status(200).json({
    ok: true,
    available: true,
    normalized: result.normalized,
  })
}
