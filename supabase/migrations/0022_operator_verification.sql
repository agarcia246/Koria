-- Operator certificate review and insurance. Search and fan-out exclude
-- operators whose verified_at is null. Unverified operators keep portal access.
-- Object names in operator-documents are {operator_id}/{file}.

alter table public.operators
  add column verified_at timestamptz,
  add column verified_by uuid references public.profiles (id) on delete set null,
  add column certificate_reviewed_at timestamptz,
  add column certificate_review_notes text,
  add column insurance_certificate_path text;

comment on column public.operators.verified_at is
  'Set by an admin after certificate and insurance review. Null keeps the operator out of search and fan-out.';

comment on column public.operators.verified_by is
  'Admin profile that set verified_at. Cleared with verification.';

comment on column public.operators.certificate_reviewed_at is
  'When an admin last saved certificate review notes.';

comment on column public.operators.certificate_review_notes is
  'Admin notes from the certificate review. Not a counsel opinion.';

comment on column public.operators.insurance_certificate_path is
  'Object path in the private operator-documents bucket.';

create or replace function public.protect_operator_verification()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  -- No JWT: migrations, seed, and the dashboard SQL editor. Portal sessions always set a role.
  if auth.role() is null or auth.role() = 'service_role' or public.is_admin() then
    return new;
  end if;
  if new.verified_at is distinct from old.verified_at
    or new.verified_by is distinct from old.verified_by
    or new.certificate_reviewed_at is distinct from old.certificate_reviewed_at
    or new.certificate_review_notes is distinct from old.certificate_review_notes
    or new.insurance_certificate_path is distinct from old.insurance_certificate_path
  then
    raise exception 'Only an admin can change operator verification';
  end if;
  return new;
end;
$$;

create trigger operators_protect_verification
  before update on public.operators
  for each row execute function public.protect_operator_verification();

revoke all on function public.protect_operator_verification() from public;
revoke all on function public.protect_operator_verification() from anon, authenticated;

insert into storage.buckets (id, name, public)
values ('operator-documents', 'operator-documents', false)
on conflict (id) do update set public = false;

create or replace function public.operator_id_from_document_path(object_name text)
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

revoke all on function public.operator_id_from_document_path(text) from public;
revoke all on function public.operator_id_from_document_path(text) from anon;
grant execute on function public.operator_id_from_document_path(text) to authenticated, service_role;

create policy operator_documents_storage_select on storage.objects
  for select to authenticated
  using (
    bucket_id = 'operator-documents'
    and (
      public.is_admin()
      or public.operator_id_from_document_path(name) in (select public.operator_ids())
    )
  );

create policy operator_documents_storage_insert on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'operator-documents'
    and public.is_admin()
  );

create policy operator_documents_storage_update on storage.objects
  for update to authenticated
  using (
    bucket_id = 'operator-documents'
    and public.is_admin()
  )
  with check (
    bucket_id = 'operator-documents'
    and public.is_admin()
  );

create policy operator_documents_storage_delete on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'operator-documents'
    and public.is_admin()
  );
