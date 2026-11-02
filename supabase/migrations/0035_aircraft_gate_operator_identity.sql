-- Aircraft publish and verified operator identity.
--
-- aircraft_member_write lets any member set is_active. Search and fan-out
-- include a tail when that flag is true, and the agreement check lived only
-- in the portal. This trigger is the database backstop.
--
-- The gate runs on every insert or update that leaves is_active true, including
-- an update that was already active. A patch that repeats is_active = true is
-- still a publish, and it is the call the policy allows today. Updates that
-- turn is_active off are allowed without an agreement so a member can take a
-- tail off the market. Already-active rows are not deactivated here (0023);
-- they cannot be written again while active until an agreement is on file.
-- That matches rejectIfActivatingWithoutAgreement, which treats a submitted
-- active flag as activating even when the row was already active.
--
-- The check is "agreement_accepted_at is not null and agreement_version is
-- non-blank". The portal still requires the exact version string in
-- web/src/lib/agreements.ts. Pinning that string in SQL would drift the next
-- time counsel bumps it, and there is no app_settings table. A blank version
-- is treated as missing.
--
-- The read of operators runs as the caller (this function is not security
-- definer). operators_select lets an authenticated member read the row.
-- No JWT (migrations, seed, SQL editor), service_role, and platform admins
-- pass through, so seed can insert active aircraft before any agreement exists.
--
-- protect_operator_verification keeps the 0022 rules and, once verified_at is
-- set, freezes the columns carrierSnapshot copies onto a quote: legal_name,
-- dba, certificate_number, certificate_type, operational_control_disclosure.
-- There is no operating_certificate_type column. Clearing verified_at (what
-- adminClearOperatorVerification does) unlocks those columns again.

create or replace function public.protect_aircraft_activation()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  accepted_at timestamptz;
  accepted_version text;
begin
  if auth.role() is null or auth.role() = 'service_role' or public.is_admin() then
    return new;
  end if;

  if new.is_active is not true then
    return new;
  end if;

  select o.agreement_accepted_at, o.agreement_version
    into accepted_at, accepted_version
  from public.operators o
  where o.id = new.operator_id;

  if accepted_at is null or accepted_version is null or btrim(accepted_version) = '' then
    raise exception 'An operator admin must accept the operator agreement before an aircraft can be set active';
  end if;

  return new;
end;
$$;

drop trigger if exists aircraft_protect_activation on public.aircraft;
create trigger aircraft_protect_activation
  before insert or update on public.aircraft
  for each row execute function public.protect_aircraft_activation();

revoke all on function public.protect_aircraft_activation() from public;
revoke all on function public.protect_aircraft_activation() from anon, authenticated;

create or replace function public.protect_operator_verification()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  -- No JWT: migrations, seed, and the dashboard SQL editor. Portal sessions always set a role.
  if auth.role() is null or auth.role() = 'service_role' or public.is_admin() then
    return new;
  end if;
  if new.verified_at is distinct from old.verified_at
    or new.verified_by is distinct from old.verified_by
    or new.certificate_reviewed_at is distinct from old.certificate_reviewed_at
    or new.certificate_review_notes is distinct from old.certificate_review_notes
    or new.insurance_certificate_path is distinct from old.insurance_certificate_path
  then
    raise exception 'Only an admin can change operator verification';
  end if;
  -- Quote-time identity. Frozen only while the row is verified; clearing
  -- verified_at (adminClearOperatorVerification) lets a member edit again.
  if old.verified_at is not null
    and (
      new.legal_name is distinct from old.legal_name
      or new.dba is distinct from old.dba
      or new.certificate_number is distinct from old.certificate_number
      or new.certificate_type is distinct from old.certificate_type
      or new.operational_control_disclosure is distinct from old.operational_control_disclosure
    )
  then
    raise exception 'Verified operator identity cannot be changed. Ask an admin to clear verification first';
  end if;
  return new;
end;
$$;

drop trigger if exists operators_protect_verification on public.operators;
create trigger operators_protect_verification
  before update on public.operators
  for each row execute function public.protect_operator_verification();

revoke all on function public.protect_operator_verification() from public;
revoke all on function public.protect_operator_verification() from anon, authenticated;
