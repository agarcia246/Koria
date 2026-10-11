-- Expire pending quotes past valid_until, and return a trip to requested
-- when quote_received has no pending or accepted quote left.
-- Job name: koria_expire_quotes. Runs are rows in public.job_runs.

create or replace function public.run_expire_quotes_job()
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  expired_count int;
  reverted_count int;
begin
  update public.quotes
  set status = 'expired'
  where status = 'pending'
    and valid_until is not null
    and valid_until < now();
  get diagnostics expired_count = row_count;

  update public.trip_requests t
  set status = 'requested'
  where t.status = 'quote_received'
    and not exists (
      select 1
      from public.quotes q
      where q.trip_request_id = t.id
        and q.status in ('pending', 'accepted')
    );
  get diagnostics reverted_count = row_count;

  insert into public.job_runs (job_name, note)
  values (
    'koria_expire_quotes',
    format('expired %s quotes, reverted %s trips', expired_count, reverted_count)
  );
  raise log 'koria_expire_quotes expired % quotes, reverted % trips', expired_count, reverted_count;
end;
$$;

revoke all on function public.run_expire_quotes_job() from public;
revoke all on function public.run_expire_quotes_job() from anon, authenticated;

do $$
begin
  perform cron.unschedule('koria_expire_quotes');
exception
  when others then
    null;
end
$$;

select cron.schedule(
  'koria_expire_quotes',
  '*/5 * * * *',
  $$select public.run_expire_quotes_job()$$
);
