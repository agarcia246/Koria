-- Charter excise rules. Rates live in rows so counsel can replace them
-- without a schema change. Quotes store the rows they used.

create table public.tax_rules (
  id uuid primary key default gen_random_uuid(),
  kind text not null,
  basis text not null,
  rate numeric,
  amount numeric,
  currency text not null default 'USD',
  effective_from date not null,
  effective_to date,
  source_url text not null,
  created_at timestamptz not null default now(),
  constraint tax_rules_kind_check check (
    kind in (
      'domestic_fet',
      'domestic_segment',
      'international_facilities',
      'alaska_hawaii_departure'
    )
  ),
  constraint tax_rules_basis_check check (
    basis in ('percent', 'per_passenger', 'per_passenger_segment')
  ),
  constraint tax_rules_value_check check (
    (basis = 'percent' and rate is not null and amount is null)
    or (basis <> 'percent' and amount is not null and rate is null)
  ),
  constraint tax_rules_window_check check (
    effective_to is null or effective_to >= effective_from
  )
);

comment on table public.tax_rules is
  'IRS air-transportation excise rules. rate is a fraction (0.075 = 7.5%) when basis is percent. amount is currency units for flat fees. Reference rows are in seed.sql.';

comment on column public.tax_rules.rate is
  'Fraction of the taxable base when basis is percent. 0.075 means 7.5%.';

alter table public.quotes
  add column tax_rule_snapshot jsonb;

alter table public.bookings
  add column tax_rule_snapshot jsonb;

comment on column public.quotes.tax_rule_snapshot is
  'Rules applied when this quote was priced. Later invoices use the snapshot and do not recompute.';

comment on column public.bookings.tax_rule_snapshot is
  'Copy of the accepted quote tax_rule_snapshot. Existing bookings stay null.';

alter table public.tax_rules enable row level security;

create policy tax_rules_select on public.tax_rules
  for select to authenticated
  using (true);

create policy tax_rules_admin on public.tax_rules
  for all to authenticated
  using (public.is_admin())
  with check (public.is_admin());

grant select, insert, update, delete on public.tax_rules to authenticated, service_role;
