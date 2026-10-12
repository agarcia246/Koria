-- Portal and operator-API mutations. Admins can read. Writes are service-role
-- only: there is no insert policy, and anon/authenticated cannot insert.
-- entity_id is polymorphic (aircraft, operator, trip, booking, and so on).
-- diff stores scalar before/after pairs. Callers omit magic links, API keys,
-- and bank details.

create table public.audit_events (
  id uuid primary key default gen_random_uuid(),
  actor_profile_id uuid references public.profiles (id) on delete set null,
  actor_role text,
  action text not null,
  entity_type text not null,
  entity_id uuid not null,
  summary text not null,
  diff jsonb,
  request_id text,
  created_at timestamptz not null default now()
);

comment on table public.audit_events is
  'Admin-readable history of portal and operator API mutations. Service role inserts. Customers and operators have no policy.';

comment on column public.audit_events.diff is
  'Scalar before/after values only. Never a magic link, API key, or bank details.';

create index audit_events_entity_idx
  on public.audit_events (entity_type, entity_id);

alter table public.audit_events enable row level security;

create policy audit_events_admin_select on public.audit_events
  for select to authenticated
  using (public.is_admin());

revoke all on public.audit_events from anon;
revoke insert, update, delete on public.audit_events from authenticated;
grant select on public.audit_events to authenticated;
grant select, insert, update, delete on public.audit_events to service_role;
