-- Phase 4 onboarding core schema
-- Safe/idempotent creation for local dev and staged rollouts

create table if not exists public.edge_businesses (
  id text primary key,
  owner_user_id text,
  plan_type text not null default 'free' check (plan_type in ('free', 'paid')),
  referral_code text,
  campaign_source text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.edge_stores (
  id text primary key,
  business_id text references public.edge_businesses(id) on delete set null,
  subdomain text not null,
  store_status text not null default 'onboarding' check (store_status in ('onboarding', 'launch_ready', 'live')),
  template_id text,
  branding_json jsonb not null default '{}'::jsonb,
  onboarding_progress_json jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists edge_stores_subdomain_unique_idx on public.edge_stores (lower(subdomain));
create index if not exists edge_stores_store_status_idx on public.edge_stores (store_status);

create table if not exists public.edge_fee_policies (
  id bigserial primary key,
  store_id text not null references public.edge_stores(id) on delete cascade,
  transaction_fee_bps integer not null check (transaction_fee_bps >= 0),
  subscription_price_cents integer not null check (subscription_price_cents >= 0),
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists edge_fee_policies_store_active_unique_idx
  on public.edge_fee_policies (store_id)
  where active = true;

create table if not exists public.edge_marketplace_product_visibility (
  id bigserial primary key,
  product_id text not null,
  store_id text not null references public.edge_stores(id) on delete cascade,
  show_on_ems boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (product_id, store_id)
);

create index if not exists edge_businesses_plan_type_idx on public.edge_businesses (plan_type);
