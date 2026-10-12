-- When the rollover job completes a trip, record an unpaid payout for
-- operator_amount minus payout_adjustment. The insert is idempotent.

alter table public.bookings
  add column payout_adjustment numeric not null default 0;

comment on column public.bookings.payout_adjustment is
  'Subtracted from operator_amount when the completion job creates the payout. Default 0.';

alter table public.payouts
  add column sent_at timestamptz,
  add column reference text;

comment on column public.payouts.sent_at is
  'When an admin marked the payout sent.';

comment on column public.payouts.reference is
  'Wire or transfer reference entered when the payout was sent.';

create or replace function public.run_rollover_trips_job()
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  upcoming_count int;
  completed_count int;
  booking_count int;
  payout_count int;
begin
  update public.trip_requests
  set status = 'upcoming'
  where status = 'confirmed'
    and depart_at <= now() + interval '72 hours';
  get diagnostics upcoming_count = row_count;

  update public.trip_requests t
  set status = 'completed'
  where t.status = 'upcoming'
    and (
      (t.return_at is not null and t.return_at <= now())
      or (
        t.return_at is null
        and exists (
          select 1
          from public.bookings b
          where b.trip_request_id = t.id
            and b.estimated_block_minutes is not null
            and t.depart_at + (b.estimated_block_minutes * interval '1 minute') <= now()
        )
      )
    );
  get diagnostics completed_count = row_count;

  update public.bookings b
  set status = 'completed'
  from public.trip_requests t
  where b.trip_request_id = t.id
    and t.status = 'completed'
    and b.status <> 'completed'
    and b.status <> 'cancelled';
  get diagnostics booking_count = row_count;

  insert into public.payouts (operator_id, booking_id, amount, currency, status)
  select q.operator_id,
         b.id,
         b.operator_amount - b.payout_adjustment,
         b.currency,
         'unpaid'
  from public.bookings b
  join public.quotes q on q.id = b.quote_id
  join public.trip_requests t on t.id = b.trip_request_id
  where t.status = 'completed'
    and b.status = 'completed'
    and not exists (
      select 1 from public.payouts p where p.booking_id = b.id
    );
  get diagnostics payout_count = row_count;

  insert into public.job_runs (job_name, note)
  values (
    'koria_rollover_trips',
    format(
      'upcoming %s, completed %s trips, %s bookings, %s payouts',
      upcoming_count,
      completed_count,
      booking_count,
      payout_count
    )
  );
  raise log 'koria_rollover_trips upcoming % completed % bookings % payouts %',
    upcoming_count, completed_count, booking_count, payout_count;
end;
$$;
