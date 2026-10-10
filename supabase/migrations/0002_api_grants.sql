-- Expose public schema to PostgREST roles.
-- Required when api.auto_expose_new_tables is unset/false (Supabase cloud default).
-- RLS still enforces row access for anon/authenticated; service_role bypasses RLS.

grant usage on schema public to anon, authenticated, service_role;

grant select, insert, update, delete, references, trigger, truncate
  on all tables in schema public
  to anon, authenticated, service_role;

grant usage, select, update
  on all sequences in schema public
  to anon, authenticated, service_role;

grant execute
  on all functions in schema public
  to anon, authenticated, service_role;

alter default privileges for role postgres in schema public
  grant select, insert, update, delete, references, trigger, truncate
  on tables to anon, authenticated, service_role;

alter default privileges for role postgres in schema public
  grant usage, select, update
  on sequences to anon, authenticated, service_role;

alter default privileges for role postgres in schema public
  grant execute
  on functions to anon, authenticated, service_role;
