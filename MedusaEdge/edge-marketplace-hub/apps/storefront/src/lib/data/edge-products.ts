"use server"

import { sdk } from "@lib/config"

type EdgeProduct = {
  id: string
  title: string
  handle: string
  thumbnail: string | null
  images: { id: string; url: string }[]
  variants: Array<{
    id: string
    title: string
    calculated_price: {
      calculated_amount: number
      original_amount: number
      currency_code: string
      calculated_price: {
        price_list_type: string
      }
    }
  }>
}

export async function listEdgeTenantProducts(params?: { limit?: number; offset?: number }) {
  return sdk.client
    .fetch<{ ok: boolean; products: EdgeProduct[]; count: number }>("/store/edge/products", {
      method: "GET",
      query: {
        limit: params?.limit || 24,
        offset: params?.offset || 0,
      },
      cache: "no-store",
    })
    .then((r) => r)
    .catch(() => ({ ok: false, products: [], count: 0 }))
}
