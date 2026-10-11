-- Who cancelled a trip, and why. Cancellation does not move money.
-- An operator withdrawing only their response stores the reason on their
-- fan-out row. The trip columns are set when the trip itself is cancelled,
-- or when the last operator withdraws and the trip becomes declined.

alter table public.trip_requests
  add column cancellation_reason text,
  add column cancelled_by uuid references public.profiles (id) on delete set null,
  add column cancelled_at timestamptz;

alter table public.trip_request_operators
  add column decline_reason text;
