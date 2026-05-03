import { Text } from "@modules/common/components/ui"
import { listEdgeTenantProducts } from "@lib/data/edge-products"
import PreviewPrice from "@modules/products/components/product-preview/price"
import Thumbnail from "@modules/products/components/thumbnail"

export default async function TenantProductGrid() {
  const { products } = await listEdgeTenantProducts({ limit: 12 })

  if (!products?.length) {
    return (
      <div className="content-container py-12">
        <Text className="text-ui-fg-subtle">No tenant products yet.</Text>
      </div>
    )
  }

  return (
    <div className="content-container py-12 small:py-24">
      <div className="flex justify-between mb-8">
        <Text className="txt-xlarge">Your tenant catalog</Text>
      </div>
      <ul className="grid grid-cols-2 small:grid-cols-3 gap-x-6 gap-y-24 small:gap-y-36">
        {products.map((product) => (
          <li key={product.id}>
            <div data-testid="tenant-product-wrapper">
              <Thumbnail
                thumbnail={product.thumbnail}
                images={product.images}
                size="full"
                isFeatured
              />
              <div className="flex txt-compact-medium mt-4 justify-between">
                <Text className="text-ui-fg-subtle">{product.title}</Text>
                <div className="flex items-center gap-x-2">
                  <PreviewPrice
                    price={{
                      calculated_price_number:
                        product.variants?.[0]?.calculated_price?.calculated_amount || 0,
                      calculated_price: `$${(
                        (product.variants?.[0]?.calculated_price?.calculated_amount || 0) / 100
                      ).toFixed(2)}`,
                      original_price_number:
                        product.variants?.[0]?.calculated_price?.original_amount || 0,
                      original_price: `$${(
                        (product.variants?.[0]?.calculated_price?.original_amount || 0) / 100
                      ).toFixed(2)}`,
                      currency_code:
                        product.variants?.[0]?.calculated_price?.currency_code || "usd",
                      price_type: "default",
                      percentage_diff: "0",
                    }}
                  />
                </div>
              </div>
            </div>
          </li>
        ))}
      </ul>
    </div>
  )
}
