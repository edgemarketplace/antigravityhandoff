-- Growth billing sync fields for Stripe subscriptions.

alter table public.tenants
  add column if not exists stripe_customer_id text,
  add column if not exists stripe_subscription_id text,
  add column if not exists growth_plan_activated_at timestamptz,
  add column if not exists plan_updated_at timestamptz not null default now();

create unique index if not exists tenants_stripe_customer_id_unique_idx
  on public.tenants (stripe_customer_id)
  where stripe_customer_id is not null;

create unique index if not exists tenants_stripe_subscription_id_unique_idx
  on public.tenants (stripe_subscription_id)
  where stripe_subscription_id is not null;
