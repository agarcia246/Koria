-- KOR-29: operator inbound API keys. The plaintext is shown once in the portal.
-- Only the SHA-256 hash is stored. Rate limiting is out of scope.

create table public.operator_api_keys (
  id uuid primary key default gen_random_uuid(),
  operator_id uuid not null references public.operators (id) on delete cascade,
  key_hash text not null unique,
  key_prefix text not null,
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  revoked_at timestamptz
);

create index operator_api_keys_operator_idx on public.operator_api_keys (operator_id);

comment on table public.operator_api_keys is
  'Bearer keys for /api/v1/operator. key_hash is SHA-256 hex. Revoke by setting revoked_at. No rate limit in M4.';

alter table public.operator_api_keys enable row level security;

-- Invoker rights: is_admin() and operator_members policies already cover the caller.
create or replace function public.is_operator_admin(p_operator_id uuid)
returns boolean
language sql
stable
set search_path = public
as $$
  select public.is_admin()
    or exists (
      select 1
      from public.operator_members om
      where om.operator_id = p_operator_id
        and om.profile_id = auth.uid()
        and om.role = 'admin'
    );
$$;

grant execute on function public.is_operator_admin(uuid) to authenticated, service_role;

create policy operator_api_keys_select on public.operator_api_keys
  for select to authenticated
  using (public.is_operator_admin(operator_id));

create policy operator_api_keys_insert on public.operator_api_keys
  for insert to authenticated
  with check (public.is_operator_admin(operator_id));

create policy operator_api_keys_update on public.operator_api_keys
  for update to authenticated
  using (public.is_operator_admin(operator_id))
  with check (public.is_operator_admin(operator_id));

grant select, insert, update on public.operator_api_keys to authenticated, service_role;
