# EdgeCommerce Early-Stage Kickoff (Phase 1–2)

> **Source roadmap:** Google Doc `1somhZFcOu1f-tSLQ0b7rtwhGpMw6e1oeCpt43In9q3M`

## Goal
Stand up the first production-ready multi-tenant foundation so one codebase can serve many storefronts by subdomain or custom domain.

## What was implemented now

1. **Next.js request routing foundation**
   - Added `proxy.ts` (Next.js 16 file convention).
   - Detects tenant by:
     - wildcard subdomain (`<slug>.edgecommerce.com`)
     - optional custom-domain map (`TENANT_CUSTOM_DOMAIN_MAP` JSON env)
   - Rewrites tenant traffic to `/stores/[tenant_slug]`.
   - Injects request headers:
     - `x-tenant-slug`
     - `x-tenant-id` (when provided via custom-domain env mapping)

2. **Supabase multi-tenant schema + security baseline**
   - Added migration: `supabase/migrations/20260425_edgecommerce_multitenant_foundation.sql`
   - New tables:
     - `tenants`
     - `members`
     - `customers`
   - Existing table updates:
     - `products.tenant_id`
     - `orders.tenant_id`
   - Added baseline RLS policies keyed off membership (`members.user_id = auth.uid()`).
   - Added best-effort `pgAudit` extension enablement (non-fatal if unavailable).

3. **Tenant storefront route scaffold**
   - Added `app/stores/[tenant_slug]/page.tsx`
   - Fetches tenant metadata + tenant-scoped products.
   - Renders tenant catalog shell and empty-state guidance.

## Manual infrastructure tasks (from roadmap) still needed

1. Buy/configure root domain (`edgecommerce.com`) at Hostinger.
2. Point nameservers to Vercel:
   - `ns1.vercel-dns.com`
   - `ns2.vercel-dns.com`
3. Add wildcard domain in Vercel project:
   - `*.edgecommerce.com`
4. Create/confirm Supabase production project.
5. Apply migration in Supabase SQL editor or CI migration pipeline.

## Environment variables to add

```bash
NEXT_PUBLIC_ROOT_DOMAIN=edgecommerce.com
TENANT_CUSTOM_DOMAIN_MAP={"acmestore.com":{"slug":"acme-corp","tenantId":"<uuid>"}}
```

## Immediate next implementation targets

1. ✅ Add protected `/admin` route group with tenant-scoped guard (tenant header/query required).
2. ✅ Build tenant-aware Product CRUD scaffolding.
3. ✅ Add real-time Orders table using Supabase Realtime subscriptions.
4. ⏳ Add Settings panel to edit `tenants.primary_color` + `tenants.logo_url`.
5. ⏳ Add tenant onboarding script/API:
   - create tenant
   - create initial admin membership
   - optional Vercel custom domain registration

## Next block completed (this iteration)

- Added `app/admin/page.tsx` tenant admin dashboard scaffold.
- Added `app/api/admin/products/route.ts` for tenant-scoped GET/POST/PATCH/DELETE.
- Added `app/api/admin/orders/route.ts` for tenant-scoped order feed.
- Added `components/AdminProductsManager.tsx` (CRUD UI).
- Added `components/RealtimeOrdersPanel.tsx` (Supabase Realtime listener + table).
- Added `lib/tenant-context.ts` for reusable tenant resolution.
- Updated `proxy.ts` to **passthrough `/admin`** while still injecting tenant headers.

## Verification commands

```bash
npm run lint
npm run build
```
