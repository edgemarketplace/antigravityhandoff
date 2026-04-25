# Smart Upgrade Engine Plan (from 12hPWTL0jSLFoXZ89ydEp7UI2AxGjMwKidasOWIs26_4)

Source guide:
- https://docs.google.com/document/d/12hPWTL0jSLFoXZ89ydEp7UI2AxGjMwKidasOWIs26_4/edit
- Export snapshot: `/tmp/edgecommerce/guide_doc_2026-04-25_2.txt`

## Goal
Build free→growth conversion mechanics that track usage fees accurately, surface savings in admin, and enable one-click upgrade.

## Implemented now (Phase 1 foundation)
- Added tenant usage/accounting columns:
  - `monthly_order_count`
  - `monthly_gmv_cents`
  - `monthly_fee_cents`
  - `current_plan` (`free|growth`)
  - `last_billing_reset`
- Added `usage_events` ledger table (tenant-scoped) with idempotency key support.
- Added atomic counter function `increment_tenant_usage(...)`.
- Wired Stripe paid-order webhook to record usage events and increment tenant counters once per order.
- Enforced free-plan-only 5% fee accumulation (growth plan yields `fee_cents=0`).

## Next block sequence
1. **Dashboard card** on admin showing MTD Orders/GMV/Fees + Growth plan comparison.
2. **Nudge system** thresholds at $50/$100/$150 (in-app + optional email/telegram channel).
3. **Order-limit modals** at 40 and 50 orders.
4. **Upgrade flow**
   - Stripe subscription checkout
   - webhook sync to set `tenants.current_plan='growth'`
   - immediate fee stop + limits removed.
5. **Monthly reset job**
   - daily cron to reset counters when 30+ days since `last_billing_reset`.

## Guardrails
- Keep usage tracking idempotent to prevent double counting from webhook retries.
- Continue resolving tenant server-side from trusted context.
- Keep monetary values in cents for arithmetic correctness.
- Keep plan changes webhook-driven and auditable.
