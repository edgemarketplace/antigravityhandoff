import { Metadata } from "next"

import FeaturedProducts from "@modules/home/components/featured-products"
import TenantProductGrid from "@modules/home/components/tenant-product-grid"
import Hero from "@modules/home/components/hero"
import LocalizedClientLink from "@modules/common/components/localized-client-link"
import { listCollections } from "@lib/data/collections"
import { getEdgeTenantContext } from "@lib/data/edge"
import { getRegion } from "@lib/data/regions"

export const metadata: Metadata = {
  title: "Medusa Next.js Starter Template",
  description:
    "A performant frontend ecommerce starter template with Next.js 15 and Medusa.",
}

export default async function Home(props: {
  params: Promise<{ countryCode: string }>
}) {
  const params = await props.params

  const { countryCode } = params

  const region = await getRegion(countryCode)

  const { collections } = await listCollections({
    fields: "id, handle, title",
  })
  const edge = await getEdgeTenantContext()

  if (!collections || !region) {
    return null
  }

  return (
    <>
      <Hero />
      <div className="content-container py-6">
        {edge?.tenant?.subdomain ? (
          <div className="mb-4 rounded border px-3 py-2 text-sm">
            Tenant context: <strong>{edge.tenant.subdomain}</strong>
          </div>
        ) : null}
        <LocalizedClientLink
          className="inline-flex items-center rounded bg-black text-white px-4 py-2 text-sm"
          href="/onboarding"
        >
          Start client signup onboarding
        </LocalizedClientLink>
      </div>
      <div className="py-12">
        {edge?.tenant?.subdomain ? (
          <TenantProductGrid />
        ) : (
          <ul className="flex flex-col gap-x-6">
            <FeaturedProducts collections={collections} region={region} />
          </ul>
        )}
      </div>
    </>
  )
}
