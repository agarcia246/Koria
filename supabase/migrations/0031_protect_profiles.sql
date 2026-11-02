-- Block self-escalation on profiles.role / access_status and access request decisions.
--
-- profiles_update_own (0001) is FOR UPDATE USING (id = auth.uid() OR is_admin())
-- with no WITH CHECK and no column restriction. access_requests_update_own_or_admin
-- has the same shape. 0002 grants UPDATE on all columns to authenticated.
-- Signup is open, and handle_new_user creates a profile for anyone, so a customer
-- JWT can otherwise PATCH role = admin and access_status = approved and is_admin()
-- becomes true for every policy.
--
-- Same pattern as protect_operator_verification (0022): pass through when there is
-- no JWT (migrations, seed, and handle_new_user on the auth admin connection),
-- when the caller is the service role (adminReviewAccess), or when the caller is
-- a platform admin. Otherwise reject a change to the listed columns.
-- Terms columns stay user-writable. access_requests has status and reviewed_by;
-- it has no reviewed_at column.

create or replace function public.protect_profile_access_fields()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  -- No JWT: migrations, seed, and the dashboard SQL editor. Portal sessions always set a role.
  if auth.role() is null or auth.role() = 'service_role' or public.is_admin() then
    return new;
  end if;
  if new.role is distinct from old.role
    or new.access_status is distinct from old.access_status
  then
    raise exception 'Only an admin can change role or access status';
  end if;
  return new;
end;
$$;

drop trigger if exists profiles_protect_access_fields on public.profiles;
create trigger profiles_protect_access_fields
  before update on public.profiles
  for each row execute function public.protect_profile_access_fields();

revoke all on function public.protect_profile_access_fields() from public;
revoke all on function public.protect_profile_access_fields() from anon, authenticated;

create or replace function public.protect_access_request_decision()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  -- No JWT: migrations, seed, and handle_new_user linking an invite. Portal sessions always set a role.
  if auth.role() is null or auth.role() = 'service_role' or public.is_admin() then
    return new;
  end if;
  if new.status is distinct from old.status
    or new.reviewed_by is distinct from old.reviewed_by
  then
    raise exception 'Only an admin can change access request status or reviewer';
  end if;
  return new;
end;
$$;

drop trigger if exists access_requests_protect_decision on public.access_requests;
create trigger access_requests_protect_decision
  before update on public.access_requests
  for each row execute function public.protect_access_request_decision();

revoke all on function public.protect_access_request_decision() from public;
revoke all on function public.protect_access_request_decision() from anon, authenticated;
