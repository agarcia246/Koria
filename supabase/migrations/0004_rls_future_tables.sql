-- Customer, operator, and admin policies for tables that previously
-- had admin-only or owner-only stubs. See supabase/RLS_AUDIT.md.

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
      )
  );
$$;

revoke all on function public.operator_can_access_trip(uuid) from public;
grant execute on function public.operator_can_access_trip(uuid) to authenticated, service_role;

-- payments: customer reads rows on their booking; operator reads rows on their quote's booking.
-- Admin write/read stays on payments_admin.
create policy payments_customer_select on public.payments
  for select to authenticated
  using (
    exists (
      select 1
      from public.bookings b
      join public.trip_requests t on t.id = b.trip_request_id
      where b.id = payments.booking_id
        and t.customer_id = auth.uid()
    )
  );

create policy payments_operator_select on public.payments
  for select to authenticated
  using (
    exists (
      select 1
      from public.bookings b
      join public.quotes q on q.id = b.quote_id
      where b.id = payments.booking_id
        and q.operator_id in (select public.operator_ids())
    )
  );

-- payouts: operator reads their own. Customers do not (see audit).
create policy payouts_operator_select on public.payouts
  for select to authenticated
  using (operator_id in (select public.operator_ids()));

-- trip documents: operator can read and write documents on trips they can access.
-- Customer and admin access stays on trip_documents_own.
create policy trip_documents_operator on public.trip_documents
  for all to authenticated
  using (public.operator_can_access_trip(trip_request_id))
  with check (public.operator_can_access_trip(trip_request_id));

-- trip members: the trip's customer and the operating carrier can read the roster.
-- A member can still read and update their own row via trip_members_own.
create policy trip_members_customer_select on public.trip_members
  for select to authenticated
  using (
    exists (
      select 1
      from public.trip_requests t
      where t.id = trip_request_id
        and t.customer_id = auth.uid()
    )
  );

create policy trip_members_operator_select on public.trip_members
  for select to authenticated
  using (public.operator_can_access_trip(trip_request_id));

-- notifications: the recipient policy already covers a customer or an operator
-- member reading their own rows. No cross-operator read.
