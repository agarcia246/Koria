-- Fan-out of a trip request to each eligible operator.
-- Customers have no policy. Operator members read and update their own rows.
-- Admin can read and write every row. Inserts happen in create_trip_with_fanout
-- (security definer, service role only).

create type public.trip_request_operator_status as enum ('pending', 'quoted', 'declined');

create table public.trip_request_operators (
  trip_id uuid not null references public.trip_requests (id) on delete cascade,
  operator_id uuid not null references public.operators (id) on delete cascade,
  status public.trip_request_operator_status not null default 'pending',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (trip_id, operator_id)
);

create index trip_request_operators_operator_idx
  on public.trip_request_operators (operator_id, status);

create trigger trip_request_operators_updated_at
  before update on public.trip_request_operators
  for each row execute function public.set_updated_at();

alter table public.trip_request_operators enable row level security;

-- Route-only trips have no aircraft_id. An operator can see the trip when they
-- have a fan-out row, a quote, or the requested aircraft.
create or replace function public.operator_can_access_trip(trip_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.trip_requests t
    where t.id = trip_id
      and (
        t.aircraft_id in (
          select a.id
          from public.aircraft a
          where a.operator_id in (select public.operator_ids())
        )
        or exists (
          select 1
          from public.quotes q
          where q.trip_request_id = t.id
            and q.operator_id in (select public.operator_ids())
        )
        or exists (
          select 1
          from public.trip_request_operators tro
          where tro.trip_id = t.id
            and tro.operator_id in (select public.operator_ids())
        )
      )
  );
$$;

revoke all on function public.operator_can_access_trip(uuid) from public;
grant execute on function public.operator_can_access_trip(uuid) to authenticated, service_role;

drop policy if exists trip_requests_operator_select on public.trip_requests;
create policy trip_requests_operator_select on public.trip_requests
  for select to authenticated
  using (public.operator_can_access_trip(id));

drop policy if exists trip_requests_operator_update on public.trip_requests;
create policy trip_requests_operator_update on public.trip_requests
  for update to authenticated
  using (public.operator_can_access_trip(id) or public.is_admin())
  with check (public.operator_can_access_trip(id) or public.is_admin());

create policy trip_request_operators_operator_select on public.trip_request_operators
  for select to authenticated
  using (operator_id in (select public.operator_ids()));

create policy trip_request_operators_operator_update on public.trip_request_operators
  for update to authenticated
  using (operator_id in (select public.operator_ids()))
  with check (operator_id in (select public.operator_ids()));

create policy trip_request_operators_admin_all on public.trip_request_operators
  for all to authenticated
  using (public.is_admin())
  with check (public.is_admin());

-- Trip row and fan-out rows commit together. Eligibility is decided by the API
-- (web/src/lib/eligibility.ts) and passed in as operator ids.
create or replace function public.create_trip_with_fanout(
  p_customer_id uuid,
  p_origin_id uuid,
  p_destination_id uuid,
  p_depart_at timestamptz,
  p_return_at timestamptz,
  p_passengers int,
  p_prefs jsonb,
  p_aircraft_id uuid,
  p_empty_leg_id uuid,
  p_notes text,
  p_operator_ids uuid[]
)
returns public.trip_requests
language plpgsql
security definer
set search_path = public
as $$
declare
  trip public.trip_requests;
  op uuid;
begin
  insert into public.trip_requests (
    customer_id,
    origin_id,
    destination_id,
    depart_at,
    return_at,
    passengers,
    prefs,
    aircraft_id,
    empty_leg_id,
    notes,
    status
  )
  values (
    p_customer_id,
    p_origin_id,
    p_destination_id,
    p_depart_at,
    p_return_at,
    p_passengers,
    coalesce(p_prefs, '{}'::jsonb),
    p_aircraft_id,
    p_empty_leg_id,
    p_notes,
    'requested'
  )
  returning * into trip;

  foreach op in array coalesce(p_operator_ids, '{}'::uuid[])
  loop
    insert into public.trip_request_operators (trip_id, operator_id, status)
    values (trip.id, op, 'pending');
  end loop;

  return trip;
end;
$$;

revoke all on function public.create_trip_with_fanout(
  uuid, uuid, uuid, timestamptz, timestamptz, int, jsonb, uuid, uuid, text, uuid[]
) from public;
revoke all on function public.create_trip_with_fanout(
  uuid, uuid, uuid, timestamptz, timestamptz, int, jsonb, uuid, uuid, text, uuid[]
) from anon, authenticated;
grant execute on function public.create_trip_with_fanout(
  uuid, uuid, uuid, timestamptz, timestamptz, int, jsonb, uuid, uuid, text, uuid[]
) to service_role;
