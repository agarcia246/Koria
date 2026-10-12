-- Operator agreement acceptance. Aircraft may be set active only when
-- agreement_version matches the current text in the app. Existing active
-- aircraft are left as they are.

alter table public.operators
  add column agreement_version text,
  add column agreement_accepted_at timestamptz,
  add column agreement_accepted_by uuid references public.profiles (id) on delete set null;

comment on column public.operators.agreement_version is
  'Version string of the operator agreement an admin accepted. Compared to the current version in the app.';

comment on column public.operators.agreement_accepted_at is
  'When an operator admin accepted agreement_version.';

comment on column public.operators.agreement_accepted_by is
  'Operator admin profile that accepted the agreement.';

create or replace function public.protect_operator_agreement()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  -- No JWT: migrations and seed. Portal sessions always set a role.
  if auth.role() is null
    or auth.role() = 'service_role'
    or public.is_admin()
    or public.is_operator_admin(old.id)
  then
    return new;
  end if;
  if new.agreement_version is distinct from old.agreement_version
    or new.agreement_accepted_at is distinct from old.agreement_accepted_at
    or new.agreement_accepted_by is distinct from old.agreement_accepted_by
  then
    raise exception 'Only an operator admin can accept the operator agreement';
  end if;
  return new;
end;
$$;

create trigger operators_protect_agreement
  before update on public.operators
  for each row execute function public.protect_operator_agreement();

revoke all on function public.protect_operator_agreement() from public;
revoke all on function public.protect_operator_agreement() from anon, authenticated;
