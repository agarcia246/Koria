-- Trips created before fan-out still need an inbox row.
-- A specific aircraft maps to that aircraft's operator. A quote maps to the
-- quoting operator. Route-only trips have no stored eligibility, so they are
-- left alone; new requests fan out in create_trip_with_fanout.

insert into public.trip_request_operators (trip_id, operator_id, status)
select q.trip_request_id,
  q.operator_id,
  case
    when t.status = 'declined' then 'declined'::public.trip_request_operator_status
    else 'quoted'::public.trip_request_operator_status
  end
from public.quotes q
join public.trip_requests t on t.id = q.trip_request_id
on conflict (trip_id, operator_id) do nothing;

insert into public.trip_request_operators (trip_id, operator_id, status)
select t.id,
  a.operator_id,
  case
    when t.status = 'declined' then 'declined'::public.trip_request_operator_status
    else 'pending'::public.trip_request_operator_status
  end
from public.trip_requests t
join public.aircraft a on a.id = t.aircraft_id
on conflict (trip_id, operator_id) do nothing;
