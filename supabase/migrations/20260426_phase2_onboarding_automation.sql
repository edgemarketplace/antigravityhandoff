-- Phase 2: AI onboarding + automation foundation

create extension if not exists pgcrypto;

alter table public.tenants
  add column if not exists theme_name text not null default 'edge-vibrant',
  add column if not exists onboarding_status text not null default 'not_started',
  add column if not exists onboarding_progress jsonb not null default '{"intake":false,"ai":false,"products":false,"provisioning":false,"admin":false,"emails":false,"shipping":false}'::jsonb,
  add column if not exists onboarding_completed_at timestamptz;

alter table public.tenants
  drop constraint if exists tenants_onboarding_status_check;

alter table public.tenants
  add constraint tenants_onboarding_status_check
  check (onboarding_status in ('not_started','in_progress','ready_to_launch','live','failed'));

alter table public.products
  add column if not exists category text,
  add column if not exists tags text[] not null default '{}'::text[],
  add column if not exists source text not null default 'manual';

alter table public.orders
  add column if not exists shipping_label_id text,
  add column if not exists shipping_status text not null default 'pending',
  add column if not exists shipping_carrier text,
  add column if not exists shipping_service text,
  add column if not exists tracking_number text,
  add column if not exists tracking_url text,
  add column if not exists shipped_at timestamptz;

create table if not exists public.onboarding_intakes (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid references public.tenants(id) on delete set null,
  business_name text not null,
  industry text not null,
  brand_tone text not null,
  admin_email text not null,
  existing_store_url text,
  product_csv text,
  product_images jsonb not null default '[]'::jsonb,
  extracted_products jsonb not null default '[]'::jsonb,
  ai_brand_summary text,
  ai_collections jsonb not null default '[]'::jsonb,
  ai_homepage_copy jsonb not null default '{}'::jsonb,
  status text not null default 'submitted',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.onboarding_intakes
  drop constraint if exists onboarding_intakes_status_check;

alter table public.onboarding_intakes
  add constraint onboarding_intakes_status_check
  check (status in ('submitted','processing','provisioning','completed','failed'));

create index if not exists onboarding_intakes_status_idx on public.onboarding_intakes(status);
create index if not exists onboarding_intakes_admin_email_idx on public.onboarding_intakes(admin_email);

create table if not exists public.email_automation_events (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid references public.tenants(id) on delete cascade,
  event_type text not null,
  recipient text not null,
  subject text not null,
  payload jsonb not null default '{}'::jsonb,
  sent_at timestamptz not null default now(),
  dedupe_key text,
  unique (event_type, dedupe_key)
);

create index if not exists email_automation_events_tenant_idx on public.email_automation_events(tenant_id);

alter table public.onboarding_intakes enable row level security;
alter table public.email_automation_events enable row level security;

create policy if not exists "tenant members can read onboarding"
  on public.onboarding_intakes
  for select
  using (
    tenant_id is not null
    and exists (
      select 1
      from public.members m
      where m.tenant_id = onboarding_intakes.tenant_id
        and m.user_id = auth.uid()
    )
  );

create policy if not exists "tenant owners admins can update onboarding"
  on public.onboarding_intakes
  for update
  using (
    tenant_id is not null
    and exists (
      select 1
      from public.members m
      where m.tenant_id = onboarding_intakes.tenant_id
        and m.user_id = auth.uid()
        and m.role in ('owner', 'admin')
    )
  )
  with check (
    tenant_id is not null
    and exists (
      select 1
      from public.members m
      where m.tenant_id = onboarding_intakes.tenant_id
        and m.user_id = auth.uid()
        and m.role in ('owner', 'admin')
    )
  );

create policy if not exists "tenant members can read email events"
  on public.email_automation_events
  for select
  using (
    tenant_id is not null
    and exists (
      select 1
      from public.members m
      where m.tenant_id = email_automation_events.tenant_id
        and m.user_id = auth.uid()
    )
  );
