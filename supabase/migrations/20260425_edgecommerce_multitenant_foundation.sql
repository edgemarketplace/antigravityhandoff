-- EdgeCommerce Phase 1/2 foundation: tenant-aware schema + baseline RLS

create table if not exists public.tenants (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  name text not null,
  custom_domain text unique,
  primary_color text,
  logo_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.members (
  id bigint generated always as identity primary key,
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null check (role in ('admin', 'staff')),
  created_at timestamptz not null default now(),
  unique (tenant_id, user_id)
);

create index if not exists members_user_id_idx on public.members (user_id);
create index if not exists members_tenant_id_idx on public.members (tenant_id);

alter table public.products
  add column if not exists tenant_id uuid references public.tenants(id) on delete cascade;

alter table public.orders
  add column if not exists tenant_id uuid references public.tenants(id) on delete cascade;

create table if not exists public.customers (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  email text not null,
  first_name text,
  last_name text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (tenant_id, email)
);

create index if not exists products_tenant_id_idx on public.products (tenant_id);
create index if not exists orders_tenant_id_idx on public.orders (tenant_id);
create index if not exists customers_tenant_id_idx on public.customers (tenant_id);

-- Optional enterprise audit extension (best-effort, may require elevated privileges)
do $$
begin
  create extension if not exists pgaudit;
exception
  when insufficient_privilege then
    raise notice 'pgaudit extension not enabled (insufficient privileges).';
  when undefined_file then
    raise notice 'pgaudit extension is not available in this Postgres environment.';
end
$$;

alter table public.tenants enable row level security;
alter table public.members enable row level security;
alter table public.products enable row level security;
alter table public.orders enable row level security;
alter table public.customers enable row level security;

create policy if not exists "members can read own memberships"
  on public.members
  for select
  using (auth.uid() = user_id);

create policy if not exists "tenant members can read tenant"
  on public.tenants
  for select
  using (
    exists (
      select 1
      from public.members m
      where m.tenant_id = tenants.id
        and m.user_id = auth.uid()
    )
  );

create policy if not exists "tenant admins can update tenant"
  on public.tenants
  for update
  using (
    exists (
      select 1
      from public.members m
      where m.tenant_id = tenants.id
        and m.user_id = auth.uid()
        and m.role = 'admin'
    )
  )
  with check (
    exists (
      select 1
      from public.members m
      where m.tenant_id = tenants.id
        and m.user_id = auth.uid()
        and m.role = 'admin'
    )
  );

create policy if not exists "tenant members can read products"
  on public.products
  for select
  using (
    exists (
      select 1
      from public.members m
      where m.tenant_id = products.tenant_id
        and m.user_id = auth.uid()
    )
  );

create policy if not exists "tenant staff can write products"
  on public.products
  for all
  using (
    exists (
      select 1
      from public.members m
      where m.tenant_id = products.tenant_id
        and m.user_id = auth.uid()
        and m.role in ('admin', 'staff')
    )
  )
  with check (
    exists (
      select 1
      from public.members m
      where m.tenant_id = products.tenant_id
        and m.user_id = auth.uid()
        and m.role in ('admin', 'staff')
    )
  );

create policy if not exists "tenant members can read orders"
  on public.orders
  for select
  using (
    exists (
      select 1
      from public.members m
      where m.tenant_id = orders.tenant_id
        and m.user_id = auth.uid()
    )
  );

create policy if not exists "tenant admins can write orders"
  on public.orders
  for all
  using (
    exists (
      select 1
      from public.members m
      where m.tenant_id = orders.tenant_id
        and m.user_id = auth.uid()
        and m.role = 'admin'
    )
  )
  with check (
    exists (
      select 1
      from public.members m
      where m.tenant_id = orders.tenant_id
        and m.user_id = auth.uid()
        and m.role = 'admin'
    )
  );

create policy if not exists "tenant members can read customers"
  on public.customers
  for select
  using (
    exists (
      select 1
      from public.members m
      where m.tenant_id = customers.tenant_id
        and m.user_id = auth.uid()
    )
  );

create policy if not exists "tenant staff can write customers"
  on public.customers
  for all
  using (
    exists (
      select 1
      from public.members m
      where m.tenant_id = customers.tenant_id
        and m.user_id = auth.uid()
        and m.role in ('admin', 'staff')
    )
  )
  with check (
    exists (
      select 1
      from public.members m
      where m.tenant_id = customers.tenant_id
        and m.user_id = auth.uid()
        and m.role in ('admin', 'staff')
    )
  );
