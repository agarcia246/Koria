-- KOR-25: nearby airports via PostGIS instead of reading the whole table.
-- Proved on the local Supabase database (Postgres 17, PostGIS 3.3): `create extension postgis` succeeds.
-- Geography distance is meters on the WGS84 spheroid. 1 nm = 1852 m.
-- Seeded pairs nearest the 50 nm edge are about 47.6 nm (inside) and 54.3 nm (outside),
-- so the spheroid and the app haversine agree on that set.

create schema if not exists extensions;
create extension if not exists postgis with schema extensions;

alter table public.airports
  add column location extensions.geography(Point, 4326)
  generated always as (
    (extensions.st_setsrid(extensions.st_makepoint(longitude, latitude), 4326))::extensions.geography
  ) stored;

create index airports_location_gix on public.airports using gist (location);

create or replace function public.airports_within_nm(
  p_lat double precision,
  p_lng double precision,
  p_nm double precision
)
returns setof public.airports
language sql
stable
set search_path = public, extensions
as $$
  select a.*
  from public.airports a
  where a.location is not null
    and extensions.st_dwithin(
      a.location,
      (extensions.st_setsrid(extensions.st_makepoint(p_lng, p_lat), 4326))::extensions.geography,
      p_nm * 1852.0
    );
$$;

grant execute on function public.airports_within_nm(double precision, double precision, double precision)
  to anon, authenticated, service_role;
