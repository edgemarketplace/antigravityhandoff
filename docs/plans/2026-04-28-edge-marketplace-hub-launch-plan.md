# Edge Marketplace Hub Launch Plan (Donald / EdgeMarketplaceHub)

Date: 2026-04-28
Owner: Donald Pemberton
Primary email/account: donald@edgemarketplacehub.com

## Source context used
- Google Doc: https://docs.google.com/document/d/1LUf3RsdlUfuh5MsFRl2AeNOLAJCZVla4inQIeOqCxFE
- Drive folder: https://drive.google.com/drive/folders/1pWA4B8mIXmyT2eFSHOWHQ9uLbfOyfM-G
- Existing codebase state: /home/creativecapital/ecommerce (active Firebase migration + multitenant admin work in progress)

## Strategic positioning (from source docs)
- Public promise should be: "Idea to Online Store in 60 Minutes".
- Internal milestone framing:
  - 15 min = onboarding intake + generated foundation
  - 30 min = products + checkout wiring + merchant-ready edits
  - 60 min = live storefront + payments + basic operational readiness
- Differentiate against Shopify with AI-guided onboarding + operational automation (not just site templates).

## Product architecture target
1. Marketing site (lead capture, offer, pricing, demos)
2. Multi-tenant commerce platform
   - Tenant isolation
   - Tenant admin
   - Product catalog + checkout
   - Payment routing modes (edge/external)
   - Shipping modes (edge/external)
3. AI onboarding engine
   - Intake -> branding -> catalog generation -> tenant provisioning
4. Automation layer
   - Email lifecycle events
   - Operational nudges
   - Upgrade triggers

## Current codebase reality check
The repo already contains major in-progress work toward this target:
- Firebase migration files present (lib/firebase-*.ts)
- Admin APIs + settings + monetization files present
- Onboarding routes/components scaffolded
- Shipping, checkout, webhook, and fee-tracking work present

Conclusion: fastest path is to FINISH and STABILIZE what exists before adding new feature branches.

## 60-day execution roadmap

### Phase 1 (Days 1-10): Stabilize Core Platform
Goals:
- Reach clean build/lint
- Verify Firebase data path is complete and consistent
- Lock tenant auth/authorization

Deliverables:
- Resolve all TS/build errors
- Confirm /admin, /api/admin/products, /api/admin/orders, /api/admin/settings are production-safe
- Validate tenant-scoped reads/writes end-to-end
- Add/update env sample for Firebase + Stripe + Shippo + Resend

Exit criteria:
- npm run lint passes
- npm run build passes
- Manual smoke test for tenant admin CRUD + storefront reads passes

### Phase 2 (Days 11-25): Checkout + Fulfillment Hardening
Goals:
- Production-safe checkout session creation
- Correct webhook accounting and idempotency
- Shipping rate + label flow operational

Deliverables:
- Validate app/actions/stripe.ts routing for payment_mode edge/external
- Validate webhook updates order + accounting once only
- Confirm shipping rates endpoint and label purchase route behavior
- Add audit logging around payment/shipping events

Exit criteria:
- Test order can complete end-to-end in test mode
- Duplicate webhook replay does not double-count
- Shipping label flow persists tracking metadata correctly

### Phase 3 (Days 26-40): 60-Minute AI Onboarding Experience
Goals:
- Intake -> auto-provisioned tenant flow operational
- Onboarding progress visible in admin
- Merchant can launch with minimal manual edits

Deliverables:
- Finalize onboarding intake/status APIs
- Finalize onboarding wizard UX in app/onboarding
- Seed default products/collections/copy from intake inputs
- Add guardrails for missing assets/data

Exit criteria:
- New merchant can reach a runnable storefront from intake in <= 60 minutes
- Onboarding progress/state persists and is visible

### Phase 4 (Days 41-60): GTM Readiness + Conversion Infrastructure
Goals:
- Launch offer pages + pricing
- Upgrade path and fee transparency
- Basic CRM + lifecycle automations active

Deliverables:
- Marketing pages for edge plans (free/growth)
- In-admin upgrade CTA + plan conversion flow
- Lifecycle emails/events for onboarding, activation, first order
- KPI dashboard baseline (activation rate, first-order time, upgrade rate)

Exit criteria:
- Live acquisition funnel exists
- First pilot cohort onboarding can be executed without engineering intervention

## Week 1 sprint (start now)
Priority order:
1. Repo hygiene + stabilization
   - run lint/build
   - isolate and fix blocking errors
2. Firebase cutover verification
   - ensure no silent Supabase dependencies remain in critical paths
3. Admin + storefront smoke test checklist
4. Checkout/webhook verification in Stripe test mode
5. Write launch checklist for first 3 pilot merchants

## Definition of done for "show on the road"
- One fresh tenant can be onboarded with donald@edgemarketplacehub.com flow
- Tenant storefront is accessible on assigned subdomain
- Product displayed and purchasable in test mode
- Order lands in admin with correct status
- Merchant settings page can switch payment/shipping modes

## Immediate next command sequence
From /home/creativecapital/ecommerce:
1. npm ci
2. npm run lint
3. npm run build
4. document and fix top blockers

(We should execute this now as Sprint Task #1.)
