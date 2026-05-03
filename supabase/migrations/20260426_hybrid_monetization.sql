-- Hybrid monetization model (Growth subscription + optional Edge Payments/Shipping)

alter table public.tenants
  add column if not exists plan text not null default 'growth',
  add column if not exists shipping_mode text not null default 'edge',
  add column if not exists payment_fee_percent numeric(5,2),
  add column if not exists shipping_markup_percent numeric(5,2);

-- Keep compatibility with prior enum values.
update public.tenants
set payment_mode = case
  when payment_mode = 'edge_payments' then 'edge'
  when payment_mode = 'byo_stripe' then 'external'
  else payment_mode
end
where payment_mode in ('edge_payments', 'byo_stripe');

-- Normalize defaults based on selected mode.
update public.tenants
set payment_mode = coalesce(nullif(payment_mode, ''), 'edge')
where payment_mode is null or payment_mode = '';

update public.tenants
set shipping_mode = coalesce(nullif(shipping_mode, ''), 'edge')
where shipping_mode is null or shipping_mode = '';

update public.tenants
set payment_fee_percent = case
  when payment_mode = 'edge' then coalesce(payment_fee_percent, 0.5)
  else 0
end;

update public.tenants
set shipping_markup_percent = case
  when shipping_mode = 'edge' then coalesce(shipping_markup_percent, 10)
  else 0
end;

alter table public.tenants
  alter column payment_mode set default 'edge';

alter table public.tenants
  alter column payment_fee_percent set default 0.5;

alter table public.tenants
  alter column shipping_markup_percent set default 10;

alter table public.tenants
  drop constraint if exists tenants_plan_check;

alter table public.tenants
  add constraint tenants_plan_check
  check (plan in ('growth'));

alter table public.tenants
  drop constraint if exists tenants_payment_mode_check;

alter table public.tenants
  add constraint tenants_payment_mode_check
  check (payment_mode in ('edge', 'external'));

alter table public.tenants
  drop constraint if exists tenants_shipping_mode_check;

alter table public.tenants
  add constraint tenants_shipping_mode_check
  check (shipping_mode in ('edge', 'external'));

alter table public.tenants
  drop constraint if exists tenants_payment_fee_percent_check;

alter table public.tenants
  add constraint tenants_payment_fee_percent_check
  check (payment_fee_percent >= 0 and payment_fee_percent <= 100);

alter table public.tenants
  drop constraint if exists tenants_shipping_markup_percent_check;

alter table public.tenants
  add constraint tenants_shipping_markup_percent_check
  check (shipping_markup_percent >= 0 and shipping_markup_percent <= 100);

create index if not exists tenants_shipping_mode_idx on public.tenants(shipping_mode);

alter table public.orders
  add column if not exists subtotal numeric(10,2),
  add column if not exists stripe_fee numeric(10,2),
  add column if not exists edge_payment_fee numeric(10,2),
  add column if not exists shipping_base_cost numeric(10,2),
  add column if not exists shipping_markup numeric(10,2),
  add column if not exists shipping_final_cost numeric(10,2),
  add column if not exists total_paid numeric(10,2);

update public.orders
set total_paid = coalesce(total_paid, amount_total),
    subtotal = coalesce(subtotal, amount_total)
where total_paid is null or subtotal is null;
