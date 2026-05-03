import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { getOnboardingBySubdomain } from "../../../../lib/edge-firestore"

function readTenantSlug(req: MedusaRequest) {
  const fromHeader = req.headers["x-edge-tenant"] as string | undefined
  const fromQuery = req.query.store as string | undefined
  return (fromHeader || fromQuery || "").trim().toLowerCase() || null
}

export async function GET(req: MedusaRequest, res: MedusaResponse) {
  const tenantSlug = readTenantSlug(req)

  if (!tenantSlug) {
    return res.status(200).json({ ok: true, tenant: null })
  }

  const tenant = await getOnboardingBySubdomain(tenantSlug)

  if (!tenant) {
    return res.status(404).json({ ok: false, tenant: null, error: "tenant not found" })
  }

  return res.status(200).json({ ok: true, tenant })
}
