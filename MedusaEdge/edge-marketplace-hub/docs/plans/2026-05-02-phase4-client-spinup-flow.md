# Edge Marketplace Hub — Phase 4 Client Spin-Up Flow Implementation Plan

Goal
Build a production-ready client onboarding and activation flow that gets a new merchant from plan selection to first live product with correct fee logic and Stripe Connect gating.

Architecture
- Keep Medusa backend as source of truth for products/orders.
- Add a lightweight onboarding domain in backend + storefront app.
- Use host-based tenant resolution for subdomains.
- Enforce launch gates (payments + shipping + product minimum) before store_status=live.

Tech stack
- apps/backend (Node/Medusa APIs + modules)
- apps/storefront (Next.js app/router)
- Supabase migrations for onboarding metadata and feature flags
- Stripe (subscription + connect)

Source doc
- Google Doc ID: 1sGWj1wiweL0SeVUpYAQDFMoQv3EM-UXHbII6MPrGD_I

MVP cutline (this phase)
1) Plan selection (Free 5% vs Paid $99 + 0.5%)
2) Store naming + subdomain reservation
3) Template selection
4) Basic branding capture
5) First product quick-add
6) Stripe Connect onboarding + fee policy assignment
7) Launch checklist + go-live gate
8) Optional marketplace visibility toggle per product

Out of scope (next phase)
- Full Printify sync
- CSV import
- Custom domain SSL lifecycle UX
- Unified multi-vendor cart
- SMS automation

----------------------------------------------------------------
Task Breakdown
----------------------------------------------------------------

Task 1: Define onboarding state model
- Files:
  - Create: apps/backend/src/modules/onboarding/types.ts
  - Create: apps/backend/src/modules/onboarding/constants.ts
- Add enums:
  - onboarding_step: plan, store_basics, business_identity, template, branding, first_product, payments, shipping, review
  - store_status: onboarding, launch_ready, live
  - plan_type: free, paid
- Add checklist flags:
  - has_product, payments_connected, shipping_configured, storefront_published

Task 2: Add DB migration for onboarding + fee policy
- Files:
  - Create: supabase/migrations/20260502_phase4_onboarding_core.sql
- Tables/columns:
  - businesses (if not present): owner_user_id, plan_type, referral_code, campaign_source
  - stores: subdomain, store_status, template_id, branding_json, onboarding_progress_json
  - fee_policy: store_id, transaction_fee_bps, subscription_price_cents, active
  - marketplace_product_visibility: product_id, store_id, show_on_ems
- Indexes:
  - unique(subdomain)
  - index(store_status)
  - index(plan_type)

Task 3: Build subdomain reservation API
- Files:
  - Create: apps/backend/src/api/admin/stores/check-subdomain/route.ts
  - Create: apps/backend/src/api/admin/stores/reserve-subdomain/route.ts
- Rules:
  - normalize slug
  - reject reserved words (admin, api, www, app)
  - profanity/basic bad-word filter
  - duplicate check

Task 4: Build plan selection + fee policy API
- Files:
  - Create: apps/backend/src/api/admin/onboarding/select-plan/route.ts
- Behavior:
  - free => fee=500 bps, subscription=0
  - paid => fee=50 bps, subscription=9900 cents
  - persist plan selection and emit onboarding event

Task 5: Add onboarding session persistence API
- Files:
  - Create: apps/backend/src/api/admin/onboarding/save-step/route.ts
  - Create: apps/backend/src/api/admin/onboarding/get-progress/route.ts
- Behavior:
  - partial saves per step
  - idempotent updates
  - returns next recommended step

Task 6: Build storefront onboarding wizard shell
- Files:
  - Create: apps/storefront/src/app/(onboarding)/start/page.tsx
  - Create: apps/storefront/src/modules/onboarding/components/wizard-shell.tsx
  - Create: apps/storefront/src/modules/onboarding/state/use-onboarding.ts
- UX:
  - progress bar
  - stepper
  - save-and-continue
  - resume incomplete onboarding

Task 7: Implement Step A/B/C UI (plan, store basics, business identity)
- Files:
  - Create: apps/storefront/src/modules/onboarding/steps/step-plan.tsx
  - Create: apps/storefront/src/modules/onboarding/steps/step-store-basics.tsx
  - Create: apps/storefront/src/modules/onboarding/steps/step-business-identity.tsx
- Include:
  - subdomain availability live check
  - referral code hidden capture from query param ?ref=

Task 8: Implement Step D/E UI (template + branding)
- Files:
  - Create: apps/storefront/src/modules/onboarding/steps/step-template.tsx
  - Create: apps/storefront/src/modules/onboarding/steps/step-branding.tsx
- Include:
  - 3-5 templates
  - optional logo and color pickers
  - skip-for-now path

Task 9: Implement Step F quick product add
- Files:
  - Create: apps/storefront/src/modules/onboarding/steps/step-first-product.tsx
  - Create: apps/backend/src/api/admin/onboarding/create-first-product/route.ts
- Inputs:
  - title, price, image, optional description
- Output:
  - has_product=true

Task 10: Stripe Connect gate + paid subscription bootstrap
- Files:
  - Create: apps/backend/src/api/admin/onboarding/connect-stripe/route.ts
  - Create: apps/backend/src/api/admin/onboarding/stripe-status/route.ts
- Behavior:
  - store Stripe connected account id
  - enforce charges_enabled/details_submitted before launch
  - if paid plan, create/verify $99 subscription

Task 11: Shipping minimum config
- Files:
  - Create: apps/storefront/src/modules/onboarding/steps/step-shipping.tsx
  - Create: apps/backend/src/api/admin/onboarding/save-shipping/route.ts
- Behavior:
  - flat/free/manual/printify option
  - mark shipping_configured=true

Task 12: Launch readiness + publish action
- Files:
  - Create: apps/backend/src/api/admin/onboarding/launch-readiness/route.ts
  - Create: apps/backend/src/api/admin/onboarding/launch/route.ts
  - Create: apps/storefront/src/modules/onboarding/steps/step-review-launch.tsx
- Rule:
  - Must satisfy: has_product && payments_connected && shipping_configured
  - On launch: set store_status=live

Task 13: Marketplace visibility toggle on products
- Files:
  - Modify: product admin form and product update endpoint
- Behavior:
  - toggle show_on_ems true/false per product
  - default false

Task 14: Tenant resolution middleware
- Files:
  - Create/Modify: storefront middleware host resolver
- Behavior:
  - parse subdomain
  - map to store
  - load theme/settings

Task 15: Eventing + notifications (email only for MVP)
- Files:
  - Create: onboarding events emitter/handler
- Trigger emails:
  - welcome
  - payment reminder
  - first product added
  - store live

Task 16: Analytics + upgrade prompt calculation
- Files:
  - Create: apps/backend/src/api/admin/metrics/fee-comparison/route.ts
- Output:
  - free_fee_total_this_month
  - projected_paid_cost
  - upgrade_recommendation boolean

Task 17: End-to-end QA checklist
- Test scenarios:
  1) Free plan merchant launches successfully
  2) Paid plan requires active subscription and connect completion
  3) Duplicate subdomain rejected
  4) Launch blocked when shipping missing
  5) Product EMS toggle reflected in API

Task 18: Deployment and rollout
- Add feature flags:
  - onboarding_v2_enabled
  - ems_visibility_toggle_enabled
- Soft launch with internal test merchants first.

----------------------------------------------------------------
Acceptance Criteria
----------------------------------------------------------------
- New merchant can complete onboarding in < 5 minutes with at least one product.
- Fee policy is correctly assigned by plan and used at order-time.
- Launch button remains disabled until readiness rules pass.
- Subdomain resolution serves the correct tenant storefront.
- Product visibility toggle controls inclusion for marketplace index.

----------------------------------------------------------------
Immediate Build Order (recommended next commands)
----------------------------------------------------------------
1) Start with Task 2 migration + Task 1 types
2) Implement Task 3 subdomain reservation
3) Implement Task 6 wizard shell and Task 7 first 3 steps
4) Add Stripe gate (Task 10) and launch readiness (Task 12)
5) Finish with first product + shipping + EMS toggle
