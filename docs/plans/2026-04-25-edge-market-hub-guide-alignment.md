# Edge Market Hub Guide Alignment (from 12fhb2R6XjDaKOcdGI9L74BrqoybZIzJHDf2vhgq1-eU)

Source guide:
- https://docs.google.com/document/d/12fhb2R6XjDaKOcdGI9L74BrqoybZIzJHDf2vhgq1-eU/edit
- Export snapshot: `/tmp/edgecommerce/guide_doc_2026-04-25.txt`

## Mission alignment
- Launch MVP quickly
- Keep payments reliable
- Keep merchant workflows simple
- Avoid over-engineering

## Current status vs blueprint

### Phase 1 (Core + checkout): mostly complete
- ✅ Next.js + TS + Tailwind
- ✅ Stripe checkout + webhook
- ✅ Server-side cart/product revalidation in checkout action
- ⚠ Inventory reduction on payment completion is not yet implemented as normalized inventory flow

### Phase 2 (Multi-tenant foundation): complete baseline
- ✅ `tenants` / `members` tables
- ✅ `tenant_id` propagated across core tables
- ✅ Host-based tenant routing via `proxy.ts`
- ✅ Tenant-scoped APIs + RLS baseline

### Phase 3 (Storefront + admin): strong baseline, one gap
- ✅ Product grid/detail/cart and tenant admin CRUD/orders
- ✅ Responsive UI with shadcn stack
- ⚠ `/admin/settings` still missing

### Phase 4 (Edge Payments monetization): partially complete
- ✅ `payment_accounts` table added
- ⚠ Stripe Connect onboarding + app fee routing not implemented yet
- ⚠ Per-tenant payment mode (`edge_payments` vs `byo_stripe`) not wired into checkout

### Phase 5 (Migration + onboarding): not started
- ⚠ CSV importer not built
- ⚠ Tenant onboarding flow (create tenant + logo + primary color) not built
- ⚠ Demo tenant seeding workflow not formalized

### Phase 6 (AI + analytics light): not started
- ⚠ AI product-description helper missing
- ⚠ Revenue/orders/top-products panel missing

## Recommended immediate execution order
1. Build `/admin/settings` (tenant profile + payment mode shell)
2. Implement Stripe Connect onboarding + account link flow
3. Wire checkout payment routing by tenant payment mode
4. Add normalized inventory decrement + order item writes on successful checkout
5. Add onboarding API + starter admin UI

## Next implementation block (ready now)

### Block A — Admin Settings + Payment Mode foundation
- Add tenant settings API route:
  - `GET/PATCH /api/admin/settings`
  - Editable: `name`, `primary_color`, `logo_url`, `custom_domain`
  - Add payment settings fields on tenants: `payment_mode`, `payment_application_fee_percent`
- Add admin settings page/section:
  - `app/admin/settings/page.tsx` or integrated tab in existing `app/admin/page.tsx`
  - Controls for:
    - Edge Payments (recommended)
    - BYO Stripe (advanced)

### Block B — Stripe Connect wiring
- Add connect onboarding endpoints:
  - `POST /api/admin/payments/connect/start`
  - `POST /api/admin/payments/connect/refresh`
- Persist Stripe account references in `payment_accounts`
- Add webhook handling for account status updates (if available in this phase)

### Block C — Checkout routing by payment mode
- If `edge_payments`:
  - create checkout session with platform account + `application_fee_amount`
- If `byo_stripe`:
  - route to connected account with no platform fee
- Keep current server-side cart validation as mandatory precondition

## Guardrails from source guide (must preserve)
- Never trust client price
- Resolve tenant server-side
- Scope all access by tenant membership/role
- Prefer pragmatic scope over feature sprawl

## Verification checklist for next block
- `npm run lint`
- `npm run build`
- Manual:
  - Update tenant settings in admin
  - Toggle payment mode and verify persistence
  - Run checkout in each mode and validate Stripe session metadata + fee behavior

