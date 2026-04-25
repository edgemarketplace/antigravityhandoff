-- Tenant admin settings baseline for Block A

alter table public.tenants
  add column if not exists payment_mode text not null default 'edge_payments',
  add column if not exists payment_application_fee_percent numeric(5,2) not null default 1;

alter table public.tenants
  drop constraint if exists tenants_payment_mode_check;

alter table public.tenants
  add constraint tenants_payment_mode_check
  check (payment_mode in ('edge_payments', 'byo_stripe'));

alter table public.tenants
  drop constraint if exists tenants_payment_application_fee_percent_check;

alter table public.tenants
  add constraint tenants_payment_application_fee_percent_check
  check (payment_application_fee_percent >= 0 and payment_application_fee_percent <= 100);

create index if not exists tenants_payment_mode_idx on public.tenants(payment_mode);
