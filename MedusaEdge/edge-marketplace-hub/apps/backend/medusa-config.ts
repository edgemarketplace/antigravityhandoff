import { loadEnv, defineConfig } from '@medusajs/framework/utils'

loadEnv(process.env.NODE_ENV || 'development', process.cwd())

const stripeApiKey = process.env.STRIPE_SECRET_KEY
const stripeWebhookSecret = process.env.STRIPE_WEBHOOK_SECRET

const paymentProviders: Array<{
  resolve: string
  id: string
  options?: {
    apiKey?: string
    webhookSecret?: string
  }
}> = []

if (stripeApiKey) {
  paymentProviders.push({
    resolve: '@medusajs/medusa/payment-stripe',
    id: 'stripe',
    options: {
      apiKey: stripeApiKey,
      webhookSecret: stripeWebhookSecret,
    },
  })
}

module.exports = defineConfig({
  projectConfig: {
    databaseUrl: process.env.DATABASE_URL,
    http: {
      storeCors: process.env.STORE_CORS!,
      adminCors: process.env.ADMIN_CORS!,
      authCors: process.env.AUTH_CORS!,
      jwtSecret: process.env.JWT_SECRET || 'supersecret',
      cookieSecret: process.env.COOKIE_SECRET || 'supersecret',
    },
  },
  modules: [
    {
      resolve: '@medusajs/medusa/payment',
      options: {
        providers: paymentProviders,
      },
    },
  ],
})
