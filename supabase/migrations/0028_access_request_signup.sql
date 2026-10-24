-- A marketing access request is stored before the person has an auth user.
-- Approving it sets status to approved and emails them. Signup has to attach
-- that row, including when it was already approved, or the new profile stays
-- requested. Invites still win.
-- The link flag is explicit: INSERT into profiles sets FOUND, so the old
-- "if not found" check after that insert did not see the invite select.

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  invite_row public.access_requests%rowtype;
  attached public.access_requests%rowtype;
  initial_status public.access_status := 'requested';
  linked boolean := false;
begin
  select * into invite_row
  from public.access_requests
  where lower(email) = lower(new.email)
    and status = 'invited'
  order by created_at desc
  limit 1;

  if found then
    initial_status := 'approved';
    linked := true;
    update public.access_requests
    set status = 'approved',
        user_id = new.id,
        updated_at = now()
    where id = invite_row.id;
  else
    select * into attached
    from public.access_requests
    where lower(email) = lower(new.email)
      and user_id is null
      and status in ('approved', 'requested')
    order by created_at desc
    limit 1;

    if found then
      linked := true;
      if attached.status = 'approved' then
        initial_status := 'approved';
      end if;
      update public.access_requests
      set user_id = new.id,
          updated_at = now()
      where id = attached.id;
    end if;
  end if;

  insert into public.profiles (id, email, display_name, role, access_status)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'display_name', split_part(new.email, '@', 1)),
    'customer',
    initial_status
  );

  if not linked then
    insert into public.access_requests (user_id, email, status)
    values (new.id, new.email, 'requested');
  end if;

  return new;
end;
$$;
