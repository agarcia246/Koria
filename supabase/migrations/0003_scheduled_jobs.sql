-- Scheduled job runner (pg_cron).
-- Job name: koria_noop. Later expiry and rollover jobs schedule the same way.
-- Runs are visible in cron.job_run_details and as rows in public.job_runs.
-- Postgres also records `raise log` lines from run_noop_job.

create extension if not exists pg_cron with schema pg_catalog;

create table if not exists public.job_runs (
  id bigint generated always as identity primary key,
  job_name text not null,
  ran_at timestamptz not null default now(),
  note text
);

alter table public.job_runs enable row level security;

drop policy if exists job_runs_admin_select on public.job_runs;
create policy job_runs_admin_select on public.job_runs
  for select to authenticated
  using (public.is_admin());

create or replace function public.run_noop_job()
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.job_runs (job_name, note)
  values ('koria_noop', 'noop');
  raise log 'koria_noop ran at %', now();
end;
$$;

revoke all on function public.run_noop_job() from public;
revoke all on function public.run_noop_job() from anon, authenticated;

do $$
begin
  perform cron.unschedule('koria_noop');
exception
  when others then
    null;
end
$$;

select cron.schedule(
  'koria_noop',
  '* * * * *',
  $$select public.run_noop_job()$$
);
