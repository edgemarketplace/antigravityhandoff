import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import {
  createOnboardingRecord,
  getOnboardingById,
  getOnboardingBySubdomain,
  listRecentOnboarding,
} from "../../../../lib/edge-firestore"

type OnboardingPayload = {
  storeName?: string
  ownerName?: string
  email?: string
  planType?: "free" | "paid"
  referralCode?: string
  campaignSource?: string
}

export async function POST(req: MedusaRequest, res: MedusaResponse) {
  const body = (req.body || {}) as OnboardingPayload
  const storeName = body.storeName?.trim()

  if (!storeName) {
    return res.status(400).json({
      ok: false,
      error: "storeName is required",
    })
  }

  const localRootHost = process.env.EDGE_LOCAL_ROOT_HOST || "127.0.0.1.nip.io"

  const tenant = await createOnboardingRecord({
    storeName,
    ownerName: body.ownerName,
    email: body.email,
    localRootHost,
    planType: body.planType === "paid" ? "paid" : "free",
    referralCode: body.referralCode,
    campaignSource: body.campaignSource,
  })

  return res.status(201).json({
    ok: true,
    tenant,
    next: {
      localStorefrontUrl: tenant.storefront_url,
      productionSubdomainHint: `https://${tenant.subdomain}.your-edge-domain.com`,
    },
  })
}

export async function GET(req: MedusaRequest, res: MedusaResponse) {
  const id = req.query.id as string | undefined
  const subdomain = req.query.subdomain as string | undefined

  if (!id && !subdomain) {
    const tenants = await listRecentOnboarding(25)
    return res.status(200).json({ ok: true, tenants })
  }

  const tenant = id ? await getOnboardingById(id) : await getOnboardingBySubdomain((subdomain || "").toLowerCase())

  if (!tenant) {
    return res.status(404).json({ ok: false, error: "tenant not found" })
  }

  return res.status(200).json({ ok: true, tenant })
}
