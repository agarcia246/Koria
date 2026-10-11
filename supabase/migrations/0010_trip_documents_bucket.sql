-- Private trip documents. Object names are {trip_id}/{file}.
-- Operators on the trip can read and write. Customers can read their trip.
-- The iOS API also issues short-lived signed URLs with the service role.

insert into storage.buckets (id, name, public)
values ('trip-documents', 'trip-documents', false)
on conflict (id) do update set public = false;

create or replace function public.trip_id_from_document_path(object_name text)
returns uuid
language plpgsql
stable
set search_path = public
as $$
declare
  folder text;
begin
  folder := (storage.foldername(object_name))[1];
  if folder is null or folder !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then
    return null;
  end if;
  return folder::uuid;
end;
$$;

revoke all on function public.trip_id_from_document_path(text) from public;
revoke all on function public.trip_id_from_document_path(text) from anon;
grant execute on function public.trip_id_from_document_path(text) to authenticated, service_role;

create policy trip_documents_storage_select on storage.objects
  for select to authenticated
  using (
    bucket_id = 'trip-documents'
    and (
      public.is_admin()
      or public.operator_can_access_trip(public.trip_id_from_document_path(name))
      or exists (
        select 1
        from public.trip_requests t
        where t.id = public.trip_id_from_document_path(name)
          and t.customer_id = auth.uid()
      )
    )
  );

create policy trip_documents_storage_insert on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'trip-documents'
    and (
      public.is_admin()
      or public.operator_can_access_trip(public.trip_id_from_document_path(name))
    )
  );

create policy trip_documents_storage_update on storage.objects
  for update to authenticated
  using (
    bucket_id = 'trip-documents'
    and (
      public.is_admin()
      or public.operator_can_access_trip(public.trip_id_from_document_path(name))
    )
  );

create policy trip_documents_storage_delete on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'trip-documents'
    and (
      public.is_admin()
      or public.operator_can_access_trip(public.trip_id_from_document_path(name))
    )
  );
