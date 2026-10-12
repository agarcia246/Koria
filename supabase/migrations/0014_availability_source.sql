-- KOR-28: where an availability window came from, so an import can replace
-- only that aircraft's imported rows and leave manual (and later API) rows.

create type public.availability_source as enum ('manual', 'import', 'api');

alter table public.aircraft_availability
  add column source public.availability_source not null default 'manual',
  add column import_batch_id uuid;

comment on column public.aircraft_availability.source is
  'manual: portal form. import: iCal/CSV upload (iCal VEVENTs are blocked windows). api: operator inbound API.';
comment on column public.aircraft_availability.import_batch_id is
  'Set on source = import. A re-upload deletes this aircraft''s import rows, then inserts a new batch.';

create index aircraft_availability_import_idx
  on public.aircraft_availability (aircraft_id, source);
