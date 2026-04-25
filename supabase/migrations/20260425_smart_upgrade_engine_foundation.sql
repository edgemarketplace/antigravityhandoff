-- Smart Upgrade Engine foundation
-- Adds tenant monthly usage counters + usage_events ledger for paid orders.

alter table public.tenants
  add column if not exists monthly_order_count integer not null default 0,
  add column if not exists monthly_gmv_cents integer not null default 0,
  add column if not exists monthly_fee_cents integer not null default 0,
  add column if not exists current_plan text not null default 'free',
  add column if not exists last_billing_reset timestamptz;

update public.tenants
set last_billing_reset = coalesce(last_billing_reset, now())
where last_billing_reset is null;

alter table public.tenants
  alter column last_billing_reset set default now();

alter table public.tenants
  drop constraint if exists tenants_current_plan_check;

alter table public.tenants
  add constraint tenants_current_plan_check
  check (current_plan in ('free', 'growth'));

create table if not exists public.usage_events (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  event_type text not null,
  amount_cents integer not null default 0 check (amount_cents >= 0),
  fee_cents integer not null default 0 check (fee_cents >= 0),
  event_key text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists usage_events_tenant_created_idx
  on public.usage_events (tenant_id, created_at desc);

create unique index if not exists usage_events_tenant_type_key_unique_idx
  on public.usage_events (tenant_id, event_type, event_key)
  where event_key is not null;

alter table public.usage_events enable row level security;

create policy if not exists "tenant members can read usage events"
  on public.usage_events
  for select
  using (
    exists (
      select 1
      from public.members m
      where m.tenant_id = usage_events.tenant_id
        and m.user_id = auth.uid()
    )
  );

create policy if not exists "tenant admins can write usage events"
  on public.usage_events
  for all
  using (
    exists (
      select 1
      from public.members m
      where m.tenant_id = usage_events.tenant_id
        and m.user_id = auth.uid()
        and m.role in ('owner', 'admin')
    )
  )
  with check (
    exists (
      select 1
      from public.members m
      where m.tenant_id = usage_events.tenant_id
        and m.user_id = auth.uid()
        and m.role in ('owner', 'admin')
    )
  );

create or replace function public.increment_tenant_usage(
  p_tenant_id uuid,
  p_amount_cents integer,
  p_fee_cents integer
)
returns void
language sql
security definer
set search_path = public
as $$
  update public.tenants
  set
    monthly_order_count = coalesce(monthly_order_count, 0) + 1,
    monthly_gmv_cents = coalesce(monthly_gmv_cents, 0) + greatest(p_amount_cents, 0),
    monthly_fee_cents = coalesce(monthly_fee_cents, 0) + greatest(p_fee_cents, 0),
    last_billing_reset = coalesce(last_billing_reset, now())
  where id = p_tenant_id;
$$;

grant execute on function public.increment_tenant_usage(uuid, integer, integer) to anon, authenticated, service_role;
