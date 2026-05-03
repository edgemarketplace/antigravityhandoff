import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { listProductsByTenant } from "../../../../lib/edge-firestore"

function tenantFromReq(req: MedusaRequest) {
  const value =
    (req.headers["x-edge-tenant"] as string | undefined) ||
    (req.query.store as string | undefined) ||
    ""

  return value.trim().toLowerCase() || null
}

export async function GET(req: MedusaRequest, res: MedusaResponse) {
  const tenant = tenantFromReq(req)
  if (!tenant) {
    return res.status(400).json({ ok: false, error: "missing tenant context" })
  }

  const limit = Math.max(Number(req.query.limit || 24), 1)
  const offset = Math.max(Number(req.query.offset || 0), 0)

  const { items, count } = await listProductsByTenant({ tenant, limit, offset })

  const products = items.map((row) => ({
    id: row.id,
    title: row.title,
    handle: row.handle,
    thumbnail: row.thumbnail,
    images: row.thumbnail ? [{ id: `${row.id}_img`, url: row.thumbnail }] : [],
    variants: [
      {
        id: `${row.id}_variant`,
        title: "Default",
        calculated_price: {
          calculated_amount: row.price_cents,
          original_amount: row.price_cents,
          currency_code: row.currency_code,
          calculated_price: {
            price_list_type: "default",
          },
        },
      },
    ],
  }))

  return res.status(200).json({
    ok: true,
    products,
    count,
  })
}
