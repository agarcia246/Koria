-- One live booking per trip, one paid wire reference per booking, one payout
-- per booking. Concurrent quote accepts and a double-submitted record-payment
-- form were both inserting a second row. Cancelled bookings and refund rows
-- stay legal.

-- A second accept on an open trip fails here. Replacing a booking is allowed
-- only after the existing one is cancelled.
create unique index if not exists bookings_one_live_per_trip
  on public.bookings (trip_request_id)
  where status <> 'cancelled';

comment on index public.bookings_one_live_per_trip is
  'One non-cancelled booking per trip. A second accept on an open trip fails here. A cancelled booking does not block a replacement.';

-- The same wire reference can be stored again as refund_due or refund_sent
-- (often a negative amount). Only a second paid row is rejected.
create unique index if not exists payments_one_per_ref
  on public.payments (booking_id, provider_ref)
  where status = 'paid' and provider_ref is not null;

comment on index public.payments_one_per_ref is
  'One paid payment per booking and wire reference. A double-submitted record-payment form fails here. Refund rows are excluded and may share the reference.';

-- run_rollover_trips_job and finishTrip both insert a payout and both check
-- for an existing row first. The index is the backstop when those checks race.
create unique index if not exists payouts_one_per_booking
  on public.payouts (booking_id);

comment on index public.payouts_one_per_booking is
  'One payout per booking. A second rollover or finishTrip insert fails here.';
