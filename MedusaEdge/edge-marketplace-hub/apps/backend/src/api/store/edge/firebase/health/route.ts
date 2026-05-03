import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { firebaseHealthcheck } from "../../../../../lib/firebase-admin"

export async function GET(_req: MedusaRequest, res: MedusaResponse) {
  try {
    const health = await firebaseHealthcheck()
    return res.status(200).json(health)
  } catch (error: any) {
    return res.status(500).json({
      ok: false,
      error: error?.message || "firebase healthcheck failed",
    })
  }
}
