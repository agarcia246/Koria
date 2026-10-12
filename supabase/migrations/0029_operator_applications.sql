-- Operator applications share access_requests. kind defaults to customer so
-- existing rows stay customer requests. company_name and certificate_number
-- are filled only for operator applications. note already exists and stays
-- nullable. Approving an operator application must not grant customer access;
-- signup therefore attaches only customer rows.

create type public.access_request_kind as enum ('customer', 'operator');

alter table public.access_requests
  add column kind public.access_request_kind not null default 'customer',
  add column company_name text,
  add column certificate_number text;

comment on column public.access_requests.kind is
  'customer uses the access approval path. operator is reviewed by creating an operator and does not grant customer access.';

comment on column public.access_requests.company_name is
  'Operator application company. Null for a customer request.';

comment on column public.access_requests.certificate_number is
  'Operator application certificate number. Null for a customer request.';

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
      and kind = 'customer'
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
