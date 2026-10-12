-- Wire invoices. The number is allocated by the column default so two
-- accepts cannot take the same KOR-YYYY-NNNNNN. Bank details are a snapshot
-- of server config at issue time.

create sequence public.invoice_number_seq;

create function public.next_invoice_number()
returns text
language sql
security definer
set search_path = public
as $$
  select 'KOR-'
    || to_char(now() at time zone 'utc', 'YYYY')
    || '-'
    || lpad(nextval('public.invoice_number_seq')::text, 6, '0');
$$;

revoke all on function public.next_invoice_number() from public;
revoke all on function public.next_invoice_number() from anon, authenticated;
grant execute on function public.next_invoice_number() to service_role;

create table public.invoices (
  id uuid primary key default gen_random_uuid(),
  number text not null unique default public.next_invoice_number(),
  booking_id uuid not null unique references public.bookings (id) on delete restrict,
  due_date date not null,
  currency text not null default 'USD',
  line_items jsonb not null,
  bank_details jsonb not null,
  amount_due numeric not null,
  status text not null default 'issued',
  pdf_path text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint invoices_status_check check (
    status in ('issued', 'partially_paid', 'paid', 'void')
  )
);

comment on table public.invoices is
  'Wire invoice for one booking. amount_due starts at the booking customer_total and falls as paid payments are recorded. pdf_path is an object in the private invoices bucket.';

comment on column public.invoices.number is
  'KOR-YYYY-NNNNNN from invoice_number_seq. The year is the UTC year of issue. The sequence does not reset.';

comment on column public.invoices.due_date is
  'Earlier of the departure date and two calendar days after issue, and not before the issue date.';

create index invoices_status_idx on public.invoices (status);

create trigger invoices_updated_at
  before update on public.invoices
  for each row execute function public.set_updated_at();

alter table public.invoices enable row level security;

-- Customer reads the invoice on their booking. Operators have no policy.
create policy invoices_customer_select on public.invoices
  for select to authenticated
  using (
    exists (
      select 1
      from public.bookings b
      join public.trip_requests t on t.id = b.trip_request_id
      where b.id = invoices.booking_id
        and t.customer_id = auth.uid()
    )
  );

create policy invoices_admin on public.invoices
  for all to authenticated
  using (public.is_admin())
  with check (public.is_admin());

grant select, insert, update, delete on public.invoices to authenticated, service_role;
grant usage, select on sequence public.invoice_number_seq to service_role;
revoke all on sequence public.invoice_number_seq from anon, authenticated;

-- Private PDFs. Object name is {invoice_id}.pdf.
insert into storage.buckets (id, name, public)
values ('invoices', 'invoices', false)
on conflict (id) do update set public = false;

create or replace function public.invoice_id_from_path(object_name text)
returns uuid
language plpgsql
stable
set search_path = public
as $$
declare
  stem text;
begin
  stem := split_part(split_part(object_name, '/', 1), '.', 1);
  if stem is null or stem !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then
    return null;
  end if;
  return stem::uuid;
end;
$$;

revoke all on function public.invoice_id_from_path(text) from public;
revoke all on function public.invoice_id_from_path(text) from anon;
grant execute on function public.invoice_id_from_path(text) to authenticated, service_role;

create policy invoices_storage_select on storage.objects
  for select to authenticated
  using (
    bucket_id = 'invoices'
    and (
      public.is_admin()
      or exists (
        select 1
        from public.invoices i
        join public.bookings b on b.id = i.booking_id
        join public.trip_requests t on t.id = b.trip_request_id
        where i.id = public.invoice_id_from_path(name)
          and t.customer_id = auth.uid()
      )
    )
  );

create policy invoices_storage_admin_write on storage.objects
  for all to authenticated
  using (bucket_id = 'invoices' and public.is_admin())
  with check (bucket_id = 'invoices' and public.is_admin());
