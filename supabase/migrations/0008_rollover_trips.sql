-- Roll confirmed trips to upcoming 72 hours before departure, and upcoming
-- trips to completed after arrival. Arrival is return_at when set, otherwise
-- depart_at plus bookings.estimated_block_minutes.
-- estimated_block_minutes is an airborne estimate (distance / cruise speed)
-- snapshotted when the customer accepts a quote. There is no filed block time.
-- Job name: koria_rollover_trips.

alter table public.bookings
  add column estimated_block_minutes int;

comment on column public.bookings.estimated_block_minutes is
  'Minutes of airborne time snapshotted at quote accept: great-circle distance divided by cruise speed. Not a filed block time.';

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

  insert into public.job_runs (job_name, note)
  values (
    'koria_rollover_trips',
    format(
      'upcoming %s, completed %s trips, %s bookings',
      upcoming_count,
      completed_count,
      booking_count
    )
  );
  raise log 'koria_rollover_trips upcoming % completed % bookings %',
    upcoming_count, completed_count, booking_count;
end;
$$;

revoke all on function public.run_rollover_trips_job() from public;
revoke all on function public.run_rollover_trips_job() from anon, authenticated;

do $$
begin
  perform cron.unschedule('koria_rollover_trips');
exception
  when others then
    null;
end
$$;

select cron.schedule(
  'koria_rollover_trips',
  '*/5 * * * *',
  $$select public.run_rollover_trips_job()$$
);
