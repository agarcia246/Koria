-- bookings_admin_update lets any member of the quoting operator update
-- every column. 0027 only stops a non-admin member from changing
-- payout_adjustment, and an operator admin may still change that column.
-- The payout is operator_amount minus payout_adjustment, and the finance
-- cross-check compares that payout to the booking, so a member who raises
-- operator_amount keeps the check green. These columns are written by the
-- service role (accept, payment, completion, operator cancel) or a platform
-- admin. payout_adjustment stays on protect_booking_payout_fields.
-- platform_fee_bps and customer_id are not columns of bookings.

create or replace function public.protect_booking_fields()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if auth.role() is null or auth.role() = 'service_role' or public.is_admin() then
    return new;
  end if;
  if new.operator_amount is distinct from old.operator_amount
    or new.platform_fee_amount is distinct from old.platform_fee_amount
    or new.taxes_amount is distinct from old.taxes_amount
    or new.customer_total is distinct from old.customer_total
    or new.currency is distinct from old.currency
    or new.status is distinct from old.status
    or new.deposit_percent is distinct from old.deposit_percent
    or new.deposit_received_at is distinct from old.deposit_received_at
    or new.quote_id is distinct from old.quote_id
    or new.trip_request_id is distinct from old.trip_request_id
    or new.broker_role_disclosure is distinct from old.broker_role_disclosure
    or new.tax_rule_snapshot is distinct from old.tax_rule_snapshot
    or new.estimated_block_minutes is distinct from old.estimated_block_minutes
  then
    raise exception 'Only an admin can change booking amounts and status';
  end if;
  return new;
end;
$$;

drop trigger if exists bookings_protect_fields on public.bookings;
create trigger bookings_protect_fields
  before update on public.bookings
  for each row execute function public.protect_booking_fields();

revoke all on function public.protect_booking_fields() from public;
revoke all on function public.protect_booking_fields() from anon, authenticated;
