# Firebase Backend Migration Plan (Edge Market Hub)

> For Hermes: Execute in small PR-sized phases; keep Stripe/Printify flows functional at all times.

Goal
- Replace Supabase (DB, auth, realtime, storage) with Firebase (Firestore, Auth, Storage, Functions) in the existing Next.js ecommerce codebase.

Architecture
- Firestore becomes source of truth for tenants, products, orders, onboarding, usage, and settings.
- Firebase Auth replaces Supabase auth and membership checks.
- Firebase Cloud Functions (or Next API routes + Firebase Admin) handle webhook-safe server mutations.
- Keep Stripe and Printify integrations, remapped to Firebase data access.

Tech stack
- firebase (client SDK)
- firebase-admin (server/admin)
- Firestore + Firebase Auth + Firebase Storage + Cloud Functions
- Existing Next.js app router + Stripe + Printify

---

## Phase 0: Foundation (no behavior changes)

Task 0.1: Add Firebase dependencies and env skeleton
- Modify: package.json
- Add env vars (no secrets committed):
  - NEXT_PUBLIC_FIREBASE_API_KEY
  - NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN
  - NEXT_PUBLIC_FIREBASE_PROJECT_ID
  - NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET
  - NEXT_PUBLIC_FIREBASE_APP_ID
  - FIREBASE_PROJECT_ID
  - FIREBASE_CLIENT_EMAIL
  - FIREBASE_PRIVATE_KEY

Task 0.2: Create Firebase clients
- Create: lib/firebase-client.ts
- Create: lib/firebase-admin.ts
- Create: lib/firebase-types.ts

Task 0.3: Introduce repository abstraction layer
- Create: lib/data/repositories.ts
- Create: lib/data/supabase-repository.ts
- Create: lib/data/firebase-repository.ts
- Rule: existing route handlers call repository methods, not Supabase directly.

Verification
- npm run lint
- npm run build

---

## Phase 1: Auth + tenant membership parity

Task 1.1: Firebase Auth bootstrap
- Create: lib/firebase-auth.ts
- Modify: lib/admin-auth.ts (adapter mode: Supabase first, Firebase optional)

Task 1.2: Membership model in Firestore
- Collections:
  - tenants/{tenantId}
  - tenants/{tenantId}/members/{userId}

Task 1.3: Tenant context adapter
- Modify: lib/tenant-context.ts
- Ensure it can resolve tenant from Firestore when Firebase flag is enabled.

Verification
- /admin still loads for existing tenant
- Role checks still enforce owner/admin/staff policies

---

## Phase 2: Data model migration (Firestore)

Task 2.1: Define canonical collections
- tenants
- products
- orders
- payment_accounts
- onboarding_intakes
- email_automation_events
- usage_events
- reviews

Task 2.2: Define document IDs/index strategy
- products: {tenantId}_{productId}
- orders: {tenantId}_{orderId}
- Composite indexes for tenant-scoped list queries (created_at desc, status filters)

Task 2.3: Add migration script from Supabase export to Firestore
- Create: scripts/migrate-supabase-to-firestore.mjs
- Input: CSV/JSON exports
- Output: batched writes with retry and idempotent upsert semantics

Verification
- Row/document counts reconcile by table/collection
- Sample tenant query parity checks match old API outputs

---

## Phase 3: Route-by-route backend cutover

Order of cutover (highest value first):
1) app/api/admin/products/route.ts
2) app/api/admin/orders/route.ts
3) app/api/admin/settings/route.ts
4) app/actions/stripe.ts
5) app/api/webhooks/stripe/route.ts
6) app/api/sync/route.ts (Printify sync)
7) app/api/onboarding/*

Task pattern per route
- Swap direct Supabase calls for repository methods
- Keep request/response contract unchanged
- Add tenant-safe query constraints in repository

Verification per route
- Existing UI pages continue to function unchanged
- Lint/build/tests pass

---

## Phase 4: Realtime + background workflows

Task 4.1: Replace Supabase realtime orders panel
- Modify: components/RealtimeOrdersPanel.tsx
- Option A: Firestore onSnapshot
- Option B: poll admin route (fallback)

Task 4.2: Replace usage tracking and idempotent webhook ledger
- Modify: lib/usage-tracking.ts
- Preserve idempotency key behavior for Stripe retries

Task 4.3: Storage migration for logos/assets
- Move from Supabase Storage references to Firebase Storage URLs

Verification
- Realtime updates visible in /admin
- Duplicate Stripe webhook does not duplicate usage counters

---

## Phase 5: Decommission Supabase

Task 5.1: Remove Supabase libs/usages
- Remove imports from:
  - lib/supabase-admin.ts
  - lib/supabase-auth.ts
  - all routes/components migrated

Task 5.2: Remove Supabase env references and docs
- Update README and deployment docs

Task 5.3: Keep a rollback switch for one release window
- Feature flag: DATA_BACKEND=firebase|supabase

Verification
- Full regression: storefront, tenant storefront, admin, onboarding, checkout, Stripe webhooks, Printify sync

---

## Firestore security model (target)

- Server writes for privileged collections (orders, payment_accounts, usage_events, onboarding_intakes).
- Client direct read rules limited to tenant members where needed.
- Never trust tenantId from client body without server-side auth/membership check.

---

## Decisions needed from Donald (to unblock execution)

1) Cutover mode
- A) Big-bang switch in one release
- B) Dual-write + phased cutover (recommended)

2) Auth source of truth
- A) Move users fully to Firebase Auth now
- B) Keep Supabase auth temporarily, migrate data layer first

3) Cloud Functions usage
- A) Use Next.js API routes + Firebase Admin only
- B) Move Stripe webhooks to Firebase Functions

4) Realtime behavior
- A) Firestore onSnapshot
- B) Keep polling for admin orders initially

Recommended defaults
- B, B, A, A respectively.

---

## Immediate first implementation slice

Slice 1 (safe, 1 session)
- Add Firebase client/admin libs
- Add repository abstraction
- Migrate only app/api/admin/products/route.ts through repository
- Keep Supabase repository as fallback

Success criteria
- Admin products list + CRUD works with DATA_BACKEND switch
- No UI contract changes
- Build and lint clean
