import { sdk } from "@lib/config"

export async function getEdgeTenantContext() {
  return sdk.client
    .fetch<{ ok: boolean; tenant: null | {
      id: string
      store_name: string
      subdomain: string
      storefront_url: string
      status: string
    } }>("/store/edge/context", {
      method: "GET",
      query: {},
      cache: "no-store",
    })
    .then((r) => r)
    .catch(() => ({ ok: false, tenant: null }))
}
