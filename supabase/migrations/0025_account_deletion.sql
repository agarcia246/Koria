-- Account deletion must not wipe broker records.
--
-- 0001 declared profiles.id references auth.users (id) on delete cascade.
-- Deleting the auth user deleted the profile. trip_requests.customer_id
-- then cascaded into quotes and bookings. profiles.id is the primary key,
-- so that foreign key cannot use ON DELETE SET NULL. ON DELETE RESTRICT
-- would preserve the rows but would also reject deleting the auth user
-- while the anonymized profile remains. Drop the foreign key.
--
-- Signups still insert profiles.id = auth.users.id from handle_new_user.
-- After deletion the profile row stays, with name and email replaced.
-- profiles has no phone column.
--
-- trip_requests.customer_id becomes ON DELETE RESTRICT so deleting the
-- profile row itself cannot remove a trip, its quotes, or its booking.
-- The delete endpoint does not delete the profile. It deletes passengers
-- and notifications, which are separate statements.

do $$
declare
  fk_name text;
begin
  select con.conname into fk_name
  from pg_constraint con
  join pg_class rel on rel.oid = con.conrelid
  join pg_namespace nsp on nsp.oid = rel.relnamespace
  where nsp.nspname = 'public'
    and rel.relname = 'profiles'
    and con.contype = 'f'
    and pg_get_constraintdef(con.oid) ~* 'auth\.users';

  if fk_name is null then
    raise exception 'profiles foreign key to auth.users was not found';
  end if;
  execute format('alter table public.profiles drop constraint %I', fk_name);
end $$;

comment on table public.profiles is
  'May outlive auth.users after account deletion. id stays. display_name and email are replaced. There is no phone column.';

do $$
declare
  fk_name text;
begin
  select con.conname into fk_name
  from pg_constraint con
  join pg_class rel on rel.oid = con.conrelid
  join pg_namespace nsp on nsp.oid = rel.relnamespace
  where nsp.nspname = 'public'
    and rel.relname = 'trip_requests'
    and con.contype = 'f'
    and pg_get_constraintdef(con.oid) ~* 'customer_id';

  if fk_name is null then
    raise exception 'trip_requests.customer_id foreign key was not found';
  end if;
  execute format('alter table public.trip_requests drop constraint %I', fk_name);
end $$;

alter table public.trip_requests
  add constraint trip_requests_customer_id_fkey
  foreign key (customer_id) references public.profiles (id) on delete restrict;

comment on column public.trip_requests.customer_id is
  'Kept when the customer deletes their account. ON DELETE RESTRICT so the trip cannot be removed by deleting the profile.';
