import { MedusaContainer } from "@medusajs/framework"
import { ContainerRegistrationKeys, ProductStatus } from "@medusajs/framework/utils"
import {
  createApiKeysWorkflow,
  createProductsWorkflow,
  createSalesChannelsWorkflow,
  linkSalesChannelsToApiKeyWorkflow,
} from "@medusajs/medusa/core-flows"

export default async function bootstrapStorefront({ container }: { container: MedusaContainer }) {
  const logger = container.resolve(ContainerRegistrationKeys.LOGGER)
  const query = container.resolve(ContainerRegistrationKeys.QUERY)

  const { data: existingChannels } = await query.graph({
    entity: "sales_channel",
    fields: ["id", "name"],
  })

  let salesChannelId = existingChannels?.[0]?.id

  if (!salesChannelId) {
    const {
      result: [defaultSalesChannel],
    } = await createSalesChannelsWorkflow(container).run({
      input: {
        salesChannelsData: [
          {
            name: "Default Sales Channel",
            description: "Created by bootstrap script",
          },
        ],
      },
    })
    salesChannelId = defaultSalesChannel.id
    logger.info(`Created sales channel ${salesChannelId}`)
  } else {
    logger.info(`Using existing sales channel ${salesChannelId}`)
  }

  const {
    result: [publishableApiKey],
  } = await createApiKeysWorkflow(container).run({
    input: {
      api_keys: [
        {
          title: `Storefront PK ${new Date().toISOString()}`,
          type: "publishable",
          created_by: "bootstrap-script",
        },
      ],
    },
  })

  await linkSalesChannelsToApiKeyWorkflow(container).run({
    input: {
      id: publishableApiKey.id,
      add: [salesChannelId],
    },
  })

  logger.info(`Created publishable key: ${publishableApiKey.token}`)

  const handle = `edge-test-shirt-${Date.now()}`
  await createProductsWorkflow(container).run({
    input: {
      products: [
        {
          title: "Edge Test Shirt",
          handle,
          description: "Bootstrap product for Stripe checkout verification",
          status: ProductStatus.PUBLISHED,
          sales_channels: [{ id: salesChannelId }],
          options: [{ title: "Size", values: ["M"] }],
          variants: [
            {
              title: "M",
              sku: `EDGE-TS-M-${Date.now()}`,
              options: { Size: "M" },
              prices: [
                { amount: 2500, currency_code: "usd" },
                { amount: 2200, currency_code: "eur" },
              ],
            },
          ],
        },
      ],
    },
  })

  logger.info(`Created product handle: ${handle}`)
}
