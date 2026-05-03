# Day 1 Smoke Test Report — Edge Marketplace Hub

Date: 2026-04-28
Environment: local dev (`npm run dev`) on /home/creativecapital/ecommerce

## Summary
Build/lint baseline is green, but runtime smoke test shows 3 launch-blocking backend/data issues.

## What passed
1. Static/app routes reachable:
   - GET / -> 200
   - GET /onboarding -> 200
   - GET /checkout -> 200
   - GET /admin -> 200
2. API guardrails behaving as expected:
   - GET /api/onboarding/status without intake_id -> 400 with clear message
   - POST /api/onboarding/intake with empty payload -> 400 validation
   - GET /api/webhooks/stripe -> 405 method not allowed

## What failed (blockers)

### Blocker A — Product detail runtime 500
- Endpoint: GET /products/showcase-1
- Status: 500
- Server error trace indicates Firestore lookup not found:
  - `findProductByPrintifyId(...)` -> `5 NOT_FOUND`
- Impact: product pages linked from homepage fail.

### Blocker B — Tenant storefront runtime 500
- Endpoint: GET /stores/firehouse-apparel
- Status: 500
- Server error trace indicates tenant lookup not found:
  - `findTenantBySlug(...)` -> `5 NOT_FOUND`
- Impact: tenant storefront route fails for expected slug.

### Blocker C — Onboarding intake hard-fails due Supabase dependency
- Endpoint: POST /api/onboarding/intake (valid JSON payload)
- Status: 500
- Error:
  - `SUPABASE_URL (or NEXT_PUBLIC_SUPABASE_URL) is missing.`
- Impact: onboarding path still depends on Supabase despite Firebase migration direction.

## Additional observations
- Admin/checkout/shipping APIs return 400 `Tenant context not found` when tenant headers/context are absent.
- This is expected for protected tenant-scoped routes, but makes local smoke testing dependent on seeded tenant context.

## Priority fix order (recommended)
1. Remove remaining Supabase dependency from onboarding flow (`lib/onboarding-engine` path) and use Firebase data layer only.
2. Seed/bootstrap at least one tenant + one product in Firestore for local/dev smoke tests.
3. Add graceful 404 fallback on product and store pages instead of throwing runtime 500 when record missing.
4. Add a local script/check that validates required Firebase env vars and warns if old Supabase-only codepaths remain.

## Day 2 target (next sprint action)
- Implement fix #1 + #3
- Seed dev tenant/product for #2
- Re-run full smoke matrix and verify:
  - /stores/<seeded-tenant> returns 200
  - /products/<seeded-product> returns 200
  - /api/onboarding/intake returns 200/202 with intake id and provisioning result
