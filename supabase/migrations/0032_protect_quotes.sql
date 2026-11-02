-- quotes_customer_update lets the trip's customer, any member of the quoting
-- operator, and an admin update every column. Accept copies operator_amount,
-- platform_fee_amount, taxes_amount, and customer_total onto the booking, so a
-- customer (or operator member) could patch customer_total to 1 and then accept.
-- Those columns, plus status, validity, aircraft, and operator, are written by
-- the service role (accept, decline, counter, expire job) or by a platform admin.
-- quotes has no platform_fee_bps column; the fee is stored as platform_fee_amount.

create or replace function public.protect_quote_fields()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  -- No JWT: migrations, seed, the SQL editor, and cron. Portal sessions always set a role.
  if auth.role() is null or auth.role() = 'service_role' or public.is_admin() then
    return new;
  end if;
  if new.operator_amount is distinct from old.operator_amount
    or new.platform_fee_amount is distinct from old.platform_fee_amount
    or new.taxes_amount is distinct from old.taxes_amount
    or new.customer_total is distinct from old.customer_total
    or new.tax_rule_snapshot is distinct from old.tax_rule_snapshot
    or new.carrier_disclosure_snapshot is distinct from old.carrier_disclosure_snapshot
    or new.status is distinct from old.status
    or new.valid_until is distinct from old.valid_until
    or new.aircraft_id is distinct from old.aircraft_id
    or new.operator_id is distinct from old.operator_id
  then
    raise exception 'Quote amounts and status are set by the platform';
  end if;
  return new;
end;
$$;

drop trigger if exists quotes_protect_fields on public.quotes;

create trigger quotes_protect_fields
  before update on public.quotes
  for each row execute function public.protect_quote_fields();

revoke all on function public.protect_quote_fields() from public;
revoke all on function public.protect_quote_fields() from anon, authenticated;
