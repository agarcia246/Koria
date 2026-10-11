-- Context for the in-app inbox. The own-row policy in 0001 is unchanged.
alter table public.notifications
  add column event text,
  add column trip_request_id uuid references public.trip_requests (id) on delete set null;

create index notifications_profile_created_idx
  on public.notifications (profile_id, created_at desc);
