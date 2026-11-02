-- trip_requests.status, customer_id, aircraft_id, and the cancellation
-- columns decide payment, rollover, and payouts. trip_requests_customer is
-- FOR ALL, and trip_requests_operator_update allows any column, so a customer
-- JWT could set status to confirmed without paying and an operator JWT could
-- rewrite ownership or flip status. Customer-editable fields (itinerary,
-- notes, fbo, prefs) stay writable.
-- estimated_block_minutes is on bookings. decline_reason is on
-- trip_request_operators. Neither column exists on trip_requests.

create or replace function public.protect_trip_request_fields()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  -- No JWT: migrations, seed, cron, and the dashboard SQL editor.
  -- Portal sessions always set a role.
  if auth.role() is null or auth.role() = 'service_role' or public.is_admin() then
    return new;
  end if;
  if new.status is distinct from old.status
    or new.customer_id is distinct from old.customer_id
    or new.aircraft_id is distinct from old.aircraft_id
    or new.cancelled_at is distinct from old.cancelled_at
    or new.cancelled_by is distinct from old.cancelled_by
    or new.cancellation_reason is distinct from old.cancellation_reason
  then
    raise exception 'Trip status and ownership are set by the platform';
  end if;
  return new;
end;
$$;

drop trigger if exists trip_requests_protect_fields on public.trip_requests;
create trigger trip_requests_protect_fields
  before update on public.trip_requests
  for each row execute function public.protect_trip_request_fields();

revoke all on function public.protect_trip_request_fields() from public;
revoke all on function public.protect_trip_request_fields() from anon, authenticated;
