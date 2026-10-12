-- One person belongs to one operator. An invite for someone who already
-- belongs to a different operator is rejected instead of moving them.
-- default_fee_bps changes the platform fee and therefore the payout split.
-- Only an operator admin, a platform admin, or the service role can change it.

create unique index operator_members_one_operator_per_profile
  on public.operator_members (profile_id);

comment on index public.operator_members_one_operator_per_profile is
  'A profile belongs to one operator. Invites do not move someone between operators.';

create or replace function public.protect_operator_payout_fields()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if auth.role() is null
    or auth.role() = 'service_role'
    or public.is_admin()
    or public.is_operator_admin(old.id)
  then
    return new;
  end if;
  if new.default_fee_bps is distinct from old.default_fee_bps then
    raise exception 'Only an operator admin can change payout-related fields';
  end if;
  return new;
end;
$$;

create trigger operators_protect_payout_fields
  before update on public.operators
  for each row execute function public.protect_operator_payout_fields();

revoke all on function public.protect_operator_payout_fields() from public;
revoke all on function public.protect_operator_payout_fields() from anon, authenticated;

-- bookings updates are open to any member of the quoting operator
-- (bookings_admin_update). payout_adjustment changes the amount paid out.
-- Only an operator admin, a platform admin, or the service role can change it.

create or replace function public.protect_booking_payout_fields()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  operator uuid;
begin
  if auth.role() is null
    or auth.role() = 'service_role'
    or public.is_admin()
  then
    return new;
  end if;
  if new.payout_adjustment is not distinct from old.payout_adjustment then
    return new;
  end if;
  select q.operator_id into operator
  from public.quotes q
  where q.id = old.quote_id;
  if operator is not null and public.is_operator_admin(operator) then
    return new;
  end if;
  raise exception 'Only an operator admin can change payout-related fields';
end;
$$;

create trigger bookings_protect_payout_fields
  before update on public.bookings
  for each row execute function public.protect_booking_payout_fields();

revoke all on function public.protect_booking_payout_fields() from public;
revoke all on function public.protect_booking_payout_fields() from anon, authenticated;

create policy profiles_operator_teammate_select on public.profiles
  for select to authenticated
  using (
    id in (
      select om.profile_id
      from public.operator_members om
      where om.operator_id in (select public.operator_ids())
    )
  );
