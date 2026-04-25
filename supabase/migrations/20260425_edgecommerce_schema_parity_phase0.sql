-- EdgeCommerce roadmap schema parity block (phase 0 hardening)

-- 1) Members: add owner role support.
do $$
begin
  if exists (
    select 1
    from pg_constraint
    where conname = 'members_role_check'
      and conrelid = 'public.members'::regclass
  ) then
    alter table public.members drop constraint members_role_check;
  end if;
end
$$;

alter table public.members
  add constraint members_role_check
  check (role in ('owner', 'admin', 'staff'));

-- Align existing RLS policies with owner/admin/staff role model.
drop policy if exists "tenant admins can update tenant" on public.tenants;
create policy "tenant admins can update tenant"
  on public.tenants
  for update
  using (
    exists (
      select 1
      from public.members m
      where m.tenant_id = tenants.id
        and m.user_id = auth.uid()
        and m.role in ('owner', 'admin')
    )
  )
  with check (
    exists (
      select 1
      from public.members m
      where m.tenant_id = tenants.id
        and m.user_id = auth.uid()
        and m.role in ('owner', 'admin')
    )
  );

drop policy if exists "tenant staff can write products" on public.products;
create policy "tenant staff can write products"
  on public.products
  for all
  using (
    exists (
      select 1
      from public.members m
      where m.tenant_id = products.tenant_id
        and m.user_id = auth.uid()
        and m.role in ('owner', 'admin', 'staff')
    )
  )
  with check (
    exists (
      select 1
      from public.members m
      where m.tenant_id = products.tenant_id
        and m.user_id = auth.uid()
        and m.role in ('owner', 'admin', 'staff')
    )
  );

drop policy if exists "tenant admins can write orders" on public.orders;
create policy "tenant admins can write orders"
  on public.orders
  for all
  using (
    exists (
      select 1
      from public.members m
      where m.tenant_id = orders.tenant_id
        and m.user_id = auth.uid()
        and m.role in ('owner', 'admin')
    )
  )
  with check (
    exists (
      select 1
      from public.members m
      where m.tenant_id = orders.tenant_id
        and m.user_id = auth.uid()
        and m.role in ('owner', 'admin')
    )
  );

drop policy if exists "tenant staff can write customers" on public.customers;
create policy "tenant staff can write customers"
  on public.customers
  for all
  using (
    exists (
      select 1
      from public.members m
      where m.tenant_id = customers.tenant_id
        and m.user_id = auth.uid()
        and m.role in ('owner', 'admin', 'staff')
    )
  )
  with check (
    exists (
      select 1
      from public.members m
      where m.tenant_id = customers.tenant_id
        and m.user_id = auth.uid()
        and m.role in ('owner', 'admin', 'staff')
    )
  );

-- 2) Product lifecycle and storefront metadata.
alter table public.products
  add column if not exists slug text,
  add column if not exists status text not null default 'active',
  add column if not exists inventory_quantity integer not null default 0,
  add column if not exists is_active boolean not null default true,
  add column if not exists updated_at timestamptz not null default now();

alter table public.products
  drop constraint if exists products_status_check;

alter table public.products
  add constraint products_status_check
  check (status in ('draft', 'active', 'archived'));

create unique index if not exists products_tenant_slug_unique_idx
  on public.products (tenant_id, slug)
  where slug is not null;

create index if not exists products_tenant_status_idx
  on public.products (tenant_id, status, is_active);

-- 3) Order line-item normalization.
create table if not exists public.order_items (
  id bigint generated always as identity primary key,
  order_id uuid not null references public.orders(id) on delete cascade,
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  product_printify_id text not null,
  variant_id bigint,
  title text not null,
  sku text,
  quantity integer not null check (quantity > 0),
  unit_price numeric(10,2) not null check (unit_price >= 0),
  line_total numeric(10,2) generated always as (quantity * unit_price) stored,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists order_items_order_id_idx on public.order_items(order_id);
create index if not exists order_items_tenant_id_idx on public.order_items(tenant_id);

-- 4) Payment account registry for tenant billing/settlement.
create table if not exists public.payment_accounts (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  provider text not null,
  account_ref text not null,
  status text not null default 'active',
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (tenant_id, provider, account_ref)
);

alter table public.payment_accounts
  drop constraint if exists payment_accounts_status_check;

alter table public.payment_accounts
  add constraint payment_accounts_status_check
  check (status in ('active', 'pending', 'disabled'));

create index if not exists payment_accounts_tenant_idx
  on public.payment_accounts (tenant_id, provider, status);

-- 5) Tenant audit log for critical admin actions.
create table if not exists public.audit_logs (
  id bigint generated always as identity primary key,
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  actor_user_id uuid references auth.users(id) on delete set null,
  action text not null,
  target_type text,
  target_id text,
  details jsonb not null default '{}'::jsonb,
  ip text,
  created_at timestamptz not null default now()
);

create index if not exists audit_logs_tenant_created_idx
  on public.audit_logs (tenant_id, created_at desc);

-- RLS for new tables.
alter table public.order_items enable row level security;
alter table public.payment_accounts enable row level security;
alter table public.audit_logs enable row level security;

create policy if not exists "tenant members can read order items"
  on public.order_items
  for select
  using (
    exists (
      select 1 from public.members m
      where m.tenant_id = order_items.tenant_id
        and m.user_id = auth.uid()
    )
  );

create policy if not exists "tenant admins can write order items"
  on public.order_items
  for all
  using (
    exists (
      select 1 from public.members m
      where m.tenant_id = order_items.tenant_id
        and m.user_id = auth.uid()
        and m.role in ('owner', 'admin')
    )
  )
  with check (
    exists (
      select 1 from public.members m
      where m.tenant_id = order_items.tenant_id
        and m.user_id = auth.uid()
        and m.role in ('owner', 'admin')
    )
  );

create policy if not exists "tenant admins can manage payment accounts"
  on public.payment_accounts
  for all
  using (
    exists (
      select 1 from public.members m
      where m.tenant_id = payment_accounts.tenant_id
        and m.user_id = auth.uid()
        and m.role in ('owner', 'admin')
    )
  )
  with check (
    exists (
      select 1 from public.members m
      where m.tenant_id = payment_accounts.tenant_id
        and m.user_id = auth.uid()
        and m.role in ('owner', 'admin')
    )
  );

create policy if not exists "tenant members can read audit logs"
  on public.audit_logs
  for select
  using (
    exists (
      select 1 from public.members m
      where m.tenant_id = audit_logs.tenant_id
        and m.user_id = auth.uid()
    )
  );

create policy if not exists "tenant admins can write audit logs"
  on public.audit_logs
  for insert
  with check (
    exists (
      select 1 from public.members m
      where m.tenant_id = audit_logs.tenant_id
        and m.user_id = auth.uid()
        and m.role in ('owner', 'admin')
    )
  );
