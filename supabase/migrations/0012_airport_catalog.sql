-- KOR-24: runway length, FBO name, and the indexes airport search needs.
-- seed.sql stays the 31-airport CI/local baseline. The OurAirports import
-- (supabase/scripts/import_airports.ts) fills these columns on staging.

alter table public.airports
  add column runway_length_ft integer,
  add column fbo_name text;

comment on column public.airports.runway_length_ft is
  'Longest runway in feet among runways OurAirports does not mark closed. Null when the catalog has no length.';
comment on column public.airports.fbo_name is
  'Optional FBO display name. The OurAirports import does not set it.';

-- Supabase keeps extensions out of public. gin_trgm_ops is referenced as extensions.gin_trgm_ops.
create schema if not exists extensions;
create extension if not exists pg_trgm with schema extensions;

-- /api/v1/airports/search is a contains match (ILIKE '%q%') on these four columns, capped at 20.
-- A btree prefix index does not serve a leading wildcard. Trigram GIN does.
create index airports_icao_trgm_idx on public.airports using gin (icao extensions.gin_trgm_ops);
create index airports_iata_trgm_idx on public.airports using gin (iata extensions.gin_trgm_ops);
create index airports_name_trgm_idx on public.airports using gin (name extensions.gin_trgm_ops);
create index airports_city_trgm_idx on public.airports using gin (city extensions.gin_trgm_ops);

-- Ranked, capped airport search. The route calls this instead of an unbounded ILIKE.
-- Exact code, then code prefix, then name/city prefix, then contains. Hard cap is 20.
create or replace function public.search_airports(p_q text, p_limit integer default 20)
returns setof public.airports
language sql
stable
set search_path = public
as $$
  with needle as (
    select left(btrim(coalesce(p_q, '')), 64) as raw
  ),
  escaped as (
    select
      raw,
      replace(replace(replace(raw, '\', '\\'), '%', '\%'), '_', '\_') as lit
    from needle
    where raw <> ''
  )
  select a.*
  from public.airports a
  cross join escaped e
  where a.icao ilike '%' || e.lit || '%' escape '\'
     or coalesce(a.iata, '') ilike '%' || e.lit || '%' escape '\'
     or a.name ilike '%' || e.lit || '%' escape '\'
     or a.city ilike '%' || e.lit || '%' escape '\'
  order by
    case
      when a.icao ilike e.lit escape '\' then 0
      when coalesce(a.iata, '') ilike e.lit escape '\' then 1
      when a.icao ilike e.lit || '%' escape '\' then 2
      when coalesce(a.iata, '') ilike e.lit || '%' escape '\' then 3
      when a.name ilike e.lit || '%' escape '\' then 4
      when a.city ilike e.lit || '%' escape '\' then 5
      else 6
    end,
    a.name
  limit least(greatest(coalesce(p_limit, 20), 0), 20);
$$;

grant execute on function public.search_airports(text, integer) to anon, authenticated, service_role;
