import { MedusaContainer } from "@medusajs/framework"
import { ContainerRegistrationKeys, ProductStatus } from "@medusajs/framework/utils"
import { createProductsWorkflow } from "@medusajs/medusa/core-flows"

export default async function createAffordableProduct({ container }: { container: MedusaContainer }) {
  const logger = container.resolve(ContainerRegistrationKeys.LOGGER)
  const query = container.resolve(ContainerRegistrationKeys.QUERY)

  const { data: salesChannels } = await query.graph({
    entity: "sales_channel",
    fields: ["id", "name"],
  })

  if (!salesChannels?.length) {
    throw new Error("No sales channel found")
  }

  const salesChannelId = salesChannels[0].id
  const handle = `edge-shirt-25-${Date.now()}`

  await createProductsWorkflow(container).run({
    input: {
      products: [
        {
          title: "Edge Test Shirt",
          handle,
          description: "Stripe checkout verification item",
          status: ProductStatus.PUBLISHED,
          sales_channels: [{ id: salesChannelId }],
          options: [{ title: "Size", values: ["M"] }],
          variants: [
            {
              title: "M",
              sku: `EDGE-TS-M-${Date.now()}`,
              manage_inventory: false,
              options: { Size: "M" },
              prices: [
                { amount: 25, currency_code: "usd" },
                { amount: 22, currency_code: "eur" },
              ],
            },
          ],
        },
      ],
    },
  })

  logger.info(`Created product handle: ${handle}`)
}
