-- Hours before departure map to a refund percent of customer_total.
-- Cancellation records a liability. It does not move money.

create table public.refund_policies (
  id uuid primary key default gen_random_uuid(),
  hours_before_departure numeric not null,
  refund_percent numeric not null,
  effective_from date not null default current_date,
  effective_to date,
  created_at timestamptz not null default now(),
  constraint refund_policies_percent_check check (refund_percent >= 0 and refund_percent <= 100),
  constraint refund_policies_window_check check (effective_to is null or effective_to >= effective_from)
);

comment on table public.refund_policies is
  'Pick the row with the greatest hours_before_departure that is still <= hours until departure. Reference rows are in seed.sql.';

alter table public.refund_policies enable row level security;

create policy refund_policies_select on public.refund_policies
  for select to authenticated
  using (true);

create policy refund_policies_admin on public.refund_policies
  for all to authenticated
  using (public.is_admin())
  with check (public.is_admin());

grant select, insert, update, delete on public.refund_policies to authenticated, service_role;
