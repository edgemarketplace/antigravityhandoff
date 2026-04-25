# Edge Market Hub Gap Audit (vs Google Doc `12X1LOHfxPMZoH59ora2_gfUIcgKFx0M8Sfok13lkj70`)

## Snapshot
This audit compares requested phases in the Google Doc against the current repo implementation.

## What is already in place
- Next.js 16 app with App Router, Tailwind, shadcn components, Supabase + Stripe + Printify wiring.
- Multi-tenant request routing via `proxy.ts` and tenant storefront route `app/stores/[tenant_slug]/page.tsx`.
- Baseline multi-tenant schema migration with `tenants`, `members`, `customers`, plus `tenant_id` columns on `products` and `orders`.
- Product sync route (`/api/sync`) and checkout/webhook baseline.
- New admin scaffold with tenant-scoped product CRUD API + realtime order panel.

## Highest-priority mismatches to update/improve

### 1) Security hardening for admin access (critical)
**Doc target:** Phase 5 requires auth + role checks.
**Current gap:** `app/admin/page.tsx` currently resolves tenant by header/query only; no authenticated membership enforcement yet.
**Improve next:**
- Require Supabase auth session on `/admin`.
- Enforce membership by tenant and role matrix (`owner/admin/staff`).
- Block non-members from all `/admin*` and block `staff` from payments/settings routes.

### 2) Checkout trust boundary (critical)
**Doc target:** Phase 4 requires server-side product and price validation by tenant.
**Current gap:** checkout action accepts `CartItem.unitPrice` from client and computes amount from client-provided values.
**Improve next:**
- Re-resolve products server-side by product IDs + tenant.
- Compute totals from DB only.
- Reject stale prices/inactive products.
- Persist `tenant_id` and `order_items` rows from canonical server values.

### 3) Schema divergence from roadmap (high)
**Doc target:** richer commerce schema (`order_items`, `payment_accounts`, `audit_logs`, product slug/inventory/status/currency fields, role `owner`).
**Current gap:** current schema is partial and optimized around Printify sync shape.
**Improve next:**
- Add migration for missing tables/columns.
- Add role expansion to include `owner`.
- Add helper function + updated_at trigger strategy consistently.
- Add explicit indexes for admin and checkout query paths.

### 4) Custom-domain tenant resolution (high)
**Doc target:** resolve tenant from custom domain DB value.
**Current gap:** custom-domain mapping currently comes from env (`TENANT_CUSTOM_DOMAIN_MAP`) rather than DB lookup.
**Improve next:**
- Resolve custom domains from `tenants.custom_domain` in server-side resolver.
- Keep env map as optional emergency override only.

### 5) Storefront route model mismatch (medium)
**Doc target:** `/stores/[slug]/products/[productSlug]` and tenant-native product pages.
**Current gap:** product detail route is global (`/products/[id]`).
**Improve next:**
- Move/duplicate detail route under tenant namespace.
- Switch cart item identity to tenant/product slug IDs.

### 6) Phase-0 docs hygiene (medium)
**Doc target:** complete setup docs and env template.
**Current gap:** README is still create-next-app default; no `.env.example` in repo.
**Improve next:**
- Add production README (setup, migrations, webhook, tenant bootstrap).
- Add `.env.example` with all required keys.

## Document-level improvements recommended
- Update references from `middleware.ts` to Next.js 16 `proxy.ts` file convention.
- Add explicit “implemented so far” checklist at top to avoid re-doing completed blocks.
- Add “critical blockers first” lane (Admin auth + checkout price validation) before new feature phases.

## Proposed immediate next block
1. Implement Supabase-authenticated tenant RBAC for `/admin` and `/api/admin/*`.
2. Refactor checkout to server-side product resolution + canonical pricing + tenant-bound order creation.
3. Add missing schema migration (`order_items`, `payment_accounts`, `audit_logs`, product fields) with safe backfill defaults.
4. Update README + `.env.example`.
