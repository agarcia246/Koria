-- KORIA initial schema
-- Enums, core tables, Part 295 fields, money split, fee rules, future tables, RLS

create extension if not exists "pgcrypto";

-- ---------------------------------------------------------------------------
-- Enums
-- ---------------------------------------------------------------------------
create type public.aircraft_category as enum (
  'very_light',
  'light',
  'midsize',
  'super_midsize',
  'heavy',
  'ultra_long_range'
);

create type public.pricing_mode as enum (
  'live',
  'estimated',
  'quote_required'
);

create type public.trip_status as enum (
  'requested',
  'quote_received',
  'awaiting_payment',
  'confirmed',
  'upcoming',
  'completed',
  'cancelled',
  'declined'
);

create type public.quote_status as enum (
  'pending',
  'accepted',
  'declined',
  'expired',
  'countered'
);

create type public.booking_status as enum (
  'pending',
  'confirmed',
  'completed',
  'cancelled'
);

create type public.access_status as enum (
  'requested',
  'approved',
  'declined',
  'invited'
);

create type public.user_role as enum (
  'customer',
  'operator',
  'admin'
);

create type public.empty_leg_status as enum (
  'published',
  'withdrawn',
  'booked'
);

create type public.availability_kind as enum (
  'available',
  'blocked'
);

-- ---------------------------------------------------------------------------
-- Helpers: updated_at trigger
-- ---------------------------------------------------------------------------
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- profiles (1:1 auth.users)
-- ---------------------------------------------------------------------------
create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  email text,
  display_name text,
  photo_url text,
  role public.user_role not null default 'customer',
  access_status public.access_status not null default 'requested',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger profiles_updated_at
  before update on public.profiles
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- access_requests
-- ---------------------------------------------------------------------------
create table public.access_requests (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users (id) on delete set null,
  email text not null,
  note text,
  status public.access_status not null default 'requested',
  reviewed_by uuid references public.profiles (id) on delete set null,
  decision_note text,
  invite_code text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index access_requests_email_idx on public.access_requests (lower(email));
create index access_requests_user_id_idx on public.access_requests (user_id);

create trigger access_requests_updated_at
  before update on public.access_requests
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- airports
-- ---------------------------------------------------------------------------
create table public.airports (
  id uuid primary key default gen_random_uuid(),
  icao text not null,
  iata text,
  name text not null,
  city text not null,
  region text,
  country text not null,
  time_zone text,
  latitude double precision not null,
  longitude double precision not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (icao)
);

create index airports_iata_idx on public.airports (iata);
create index airports_city_idx on public.airports (lower(city));

create trigger airports_updated_at
  before update on public.airports
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- operators (Part 295)
-- ---------------------------------------------------------------------------
create table public.operators (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  code text not null unique,
  city text,
  home_airport_id uuid references public.airports (id) on delete set null,
  legal_name text not null,
  dba text,
  certificate_number text not null,
  certificate_type text not null default 'Part 135',
  operational_control_disclosure text,
  contact_email text,
  contact_phone text,
  default_fee_bps int,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger operators_updated_at
  before update on public.operators
  for each row execute function public.set_updated_at();

create table public.operator_members (
  id uuid primary key default gen_random_uuid(),
  operator_id uuid not null references public.operators (id) on delete cascade,
  profile_id uuid not null references public.profiles (id) on delete cascade,
  role text not null default 'member',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (operator_id, profile_id)
);

create trigger operator_members_updated_at
  before update on public.operator_members
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- aircraft_models + aircraft
-- ---------------------------------------------------------------------------
create table public.aircraft_models (
  id uuid primary key default gen_random_uuid(),
  manufacturer text not null,
  name text not null,
  category public.aircraft_category not null,
  range_nm int not null,
  cruise_speed_ktas int not null,
  typical_pax int not null,
  max_pax int not null,
  cabin_length_ft numeric,
  cabin_width_ft numeric,
  cabin_height_ft numeric,
  baggage_cu_ft numeric,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger aircraft_models_updated_at
  before update on public.aircraft_models
  for each row execute function public.set_updated_at();

create table public.aircraft (
  id uuid primary key default gen_random_uuid(),
  operator_id uuid not null references public.operators (id) on delete cascade,
  model_id uuid not null references public.aircraft_models (id) on delete restrict,
  tail_number text not null,
  year int,
  seating int not null,
  interior_configuration text,
  baggage_cu_ft numeric,
  wifi boolean not null default false,
  lavatory boolean not null default false,
  pets boolean not null default false,
  golf boolean not null default false,
  skis boolean not null default false,
  cabin_notes text,
  home_base_id uuid references public.airports (id) on delete set null,
  is_active boolean not null default true,
  pricing_mode_default public.pricing_mode not null default 'quote_required',
  pet_policy text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (operator_id, tail_number)
);

create index aircraft_operator_idx on public.aircraft (operator_id);
create index aircraft_active_idx on public.aircraft (is_active);

create trigger aircraft_updated_at
  before update on public.aircraft
  for each row execute function public.set_updated_at();

create table public.aircraft_photos (
  id uuid primary key default gen_random_uuid(),
  aircraft_id uuid not null references public.aircraft (id) on delete cascade,
  storage_path text not null,
  sort_order int not null default 0,
  caption text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger aircraft_photos_updated_at
  before update on public.aircraft_photos
  for each row execute function public.set_updated_at();

create table public.aircraft_pricing_rules (
  id uuid primary key default gen_random_uuid(),
  aircraft_id uuid not null references public.aircraft (id) on delete cascade unique,
  hourly_rate numeric,
  minimum numeric,
  per_nm numeric,
  positioning_fee numeric,
  mode public.pricing_mode not null default 'quote_required',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger aircraft_pricing_rules_updated_at
  before update on public.aircraft_pricing_rules
  for each row execute function public.set_updated_at();

create table public.aircraft_availability (
  id uuid primary key default gen_random_uuid(),
  aircraft_id uuid not null references public.aircraft (id) on delete cascade,
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  kind public.availability_kind not null,
  based_at_id uuid references public.airports (id) on delete set null,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (ends_at > starts_at)
);

create index aircraft_availability_aircraft_idx on public.aircraft_availability (aircraft_id);
create index aircraft_availability_range_idx on public.aircraft_availability (starts_at, ends_at);

create trigger aircraft_availability_updated_at
  before update on public.aircraft_availability
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- searches, trip_requests, quotes, bookings, empty_legs
-- ---------------------------------------------------------------------------
create table public.searches (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid references public.profiles (id) on delete set null,
  query jsonb not null default '{}'::jsonb,
  result_count int,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger searches_updated_at
  before update on public.searches
  for each row execute function public.set_updated_at();

create table public.empty_legs (
  id uuid primary key default gen_random_uuid(),
  operator_id uuid not null references public.operators (id) on delete cascade,
  aircraft_id uuid not null references public.aircraft (id) on delete cascade,
  origin_id uuid not null references public.airports (id) on delete restrict,
  destination_id uuid not null references public.airports (id) on delete restrict,
  depart_at timestamptz not null,
  seats_available int,
  whole_aircraft boolean not null default true,
  price numeric,
  pricing_mode public.pricing_mode not null default 'estimated',
  notes text,
  status public.empty_leg_status not null default 'published',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index empty_legs_status_idx on public.empty_legs (status);
create index empty_legs_depart_idx on public.empty_legs (depart_at);

create trigger empty_legs_updated_at
  before update on public.empty_legs
  for each row execute function public.set_updated_at();

create table public.trip_requests (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid not null references public.profiles (id) on delete cascade,
  origin_id uuid not null references public.airports (id) on delete restrict,
  destination_id uuid not null references public.airports (id) on delete restrict,
  depart_at timestamptz not null,
  return_at timestamptz,
  passengers int not null default 1,
  prefs jsonb not null default '{}'::jsonb,
  flexible_days int not null default 0,
  nearby_airports boolean not null default false,
  aircraft_id uuid references public.aircraft (id) on delete set null,
  empty_leg_id uuid references public.empty_legs (id) on delete set null,
  status public.trip_status not null default 'requested',
  notes text,
  fbo text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index trip_requests_customer_idx on public.trip_requests (customer_id);
create index trip_requests_status_idx on public.trip_requests (status);
create index trip_requests_aircraft_idx on public.trip_requests (aircraft_id);

create trigger trip_requests_updated_at
  before update on public.trip_requests
  for each row execute function public.set_updated_at();

create table public.quotes (
  id uuid primary key default gen_random_uuid(),
  trip_request_id uuid not null references public.trip_requests (id) on delete cascade,
  operator_id uuid not null references public.operators (id) on delete cascade,
  aircraft_id uuid not null references public.aircraft (id) on delete restrict,
  operator_amount numeric not null,
  platform_fee_amount numeric not null default 0,
  taxes_amount numeric not null default 0,
  customer_total numeric not null,
  currency text not null default 'USD',
  valid_until timestamptz,
  notes text,
  status public.quote_status not null default 'pending',
  parent_quote_id uuid references public.quotes (id) on delete set null,
  carrier_disclosure_snapshot jsonb,
  pricing_mode public.pricing_mode not null default 'quote_required',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index quotes_trip_idx on public.quotes (trip_request_id);
create index quotes_operator_idx on public.quotes (operator_id);

create trigger quotes_updated_at
  before update on public.quotes
  for each row execute function public.set_updated_at();

create table public.bookings (
  id uuid primary key default gen_random_uuid(),
  trip_request_id uuid not null references public.trip_requests (id) on delete cascade,
  quote_id uuid not null references public.quotes (id) on delete restrict,
  status public.booking_status not null default 'pending',
  operator_amount numeric not null,
  platform_fee_amount numeric not null default 0,
  taxes_amount numeric not null default 0,
  customer_total numeric not null,
  currency text not null default 'USD',
  operating_carrier_legal_name text,
  operating_carrier_dba text,
  certificate_number text,
  broker_role_disclosure text,
  fbo text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index bookings_trip_idx on public.bookings (trip_request_id);

create trigger bookings_updated_at
  before update on public.bookings
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- passengers, preferences, platform fees, passport
-- ---------------------------------------------------------------------------
create table public.passenger_profiles (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid not null references public.profiles (id) on delete cascade,
  full_name text not null,
  date_of_birth date,
  weight_lb int,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger passenger_profiles_updated_at
  before update on public.passenger_profiles
  for each row execute function public.set_updated_at();

create table public.preferences (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid not null references public.profiles (id) on delete cascade unique,
  home_airport_id uuid references public.airports (id) on delete set null,
  typical_passengers int,
  pets boolean not null default false,
  wifi_preferred boolean not null default false,
  ski_golf boolean not null default false,
  aircraft_preferences text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger preferences_updated_at
  before update on public.preferences
  for each row execute function public.set_updated_at();

create table public.platform_fee_rules (
  id uuid primary key default gen_random_uuid(),
  scope text not null check (scope in ('global', 'operator', 'booking')),
  operator_id uuid references public.operators (id) on delete cascade,
  booking_id uuid references public.bookings (id) on delete cascade,
  bps int,
  fixed_amount numeric,
  effective_from timestamptz not null default now(),
  effective_to timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (bps is not null or fixed_amount is not null)
);

create trigger platform_fee_rules_updated_at
  before update on public.platform_fee_rules
  for each row execute function public.set_updated_at();

create table public.passport_stamps (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid not null references public.profiles (id) on delete cascade,
  title text not null,
  detail text,
  is_earned boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger passport_stamps_updated_at
  before update on public.passport_stamps
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- Future / unused tables (schema designed now)
-- ---------------------------------------------------------------------------
create table public.payments (
  id uuid primary key default gen_random_uuid(),
  booking_id uuid references public.bookings (id) on delete set null,
  amount numeric,
  currency text default 'USD',
  provider text,
  provider_ref text,
  status text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.payouts (
  id uuid primary key default gen_random_uuid(),
  operator_id uuid references public.operators (id) on delete set null,
  booking_id uuid references public.bookings (id) on delete set null,
  amount numeric,
  currency text default 'USD',
  status text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.trip_documents (
  id uuid primary key default gen_random_uuid(),
  trip_request_id uuid references public.trip_requests (id) on delete cascade,
  title text,
  storage_path text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.trip_members (
  id uuid primary key default gen_random_uuid(),
  trip_request_id uuid references public.trip_requests (id) on delete cascade,
  profile_id uuid references public.profiles (id) on delete cascade,
  role text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.route_watches (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid references public.profiles (id) on delete cascade,
  origin_id uuid references public.airports (id) on delete cascade,
  destination_id uuid references public.airports (id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid references public.profiles (id) on delete cascade,
  title text,
  body text,
  read_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Auth trigger: profile + access_request on signup; honor invites
-- ---------------------------------------------------------------------------
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  invite_row public.access_requests%rowtype;
  initial_status public.access_status := 'requested';
begin
  select * into invite_row
  from public.access_requests
  where lower(email) = lower(new.email)
    and status = 'invited'
  order by created_at desc
  limit 1;

  if found then
    initial_status := 'approved';
    update public.access_requests
    set status = 'approved',
        user_id = new.id,
        updated_at = now()
    where id = invite_row.id;
  end if;

  insert into public.profiles (id, email, display_name, role, access_status)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'display_name', split_part(new.email, '@', 1)),
    'customer',
    initial_status
  );

  if not found then
    insert into public.access_requests (user_id, email, status)
    values (new.id, new.email, 'requested');
  end if;

  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------------------------------------------------------------------------
-- RLS helpers
-- ---------------------------------------------------------------------------
create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.profiles p
    where p.id = auth.uid() and p.role = 'admin'
  );
$$;

create or replace function public.operator_ids()
returns setof uuid
language sql
stable
security definer
set search_path = public
as $$
  select om.operator_id
  from public.operator_members om
  where om.profile_id = auth.uid();
$$;

-- ---------------------------------------------------------------------------
-- RLS policies
-- ---------------------------------------------------------------------------
alter table public.profiles enable row level security;
alter table public.access_requests enable row level security;
alter table public.operators enable row level security;
alter table public.operator_members enable row level security;
alter table public.airports enable row level security;
alter table public.aircraft_models enable row level security;
alter table public.aircraft enable row level security;
alter table public.aircraft_photos enable row level security;
alter table public.aircraft_pricing_rules enable row level security;
alter table public.aircraft_availability enable row level security;
alter table public.searches enable row level security;
alter table public.trip_requests enable row level security;
alter table public.quotes enable row level security;
alter table public.bookings enable row level security;
alter table public.empty_legs enable row level security;
alter table public.passenger_profiles enable row level security;
alter table public.preferences enable row level security;
alter table public.platform_fee_rules enable row level security;
alter table public.passport_stamps enable row level security;
alter table public.payments enable row level security;
alter table public.payouts enable row level security;
alter table public.trip_documents enable row level security;
alter table public.trip_members enable row level security;
alter table public.route_watches enable row level security;
alter table public.notifications enable row level security;

-- profiles
create policy profiles_select_own_or_admin on public.profiles
  for select to authenticated
  using (id = auth.uid() or public.is_admin());

create policy profiles_update_own on public.profiles
  for update to authenticated
  using (id = auth.uid() or public.is_admin());

create policy profiles_admin_all on public.profiles
  for all to authenticated
  using (public.is_admin())
  with check (public.is_admin());

-- access_requests
create policy access_requests_select_own on public.access_requests
  for select to authenticated
  using (user_id = auth.uid() or lower(email) = lower(coalesce(auth.jwt()->>'email', '')) or public.is_admin());

create policy access_requests_insert_own on public.access_requests
  for insert to authenticated
  with check (user_id = auth.uid() or public.is_admin());

create policy access_requests_update_own_or_admin on public.access_requests
  for update to authenticated
  using (user_id = auth.uid() or public.is_admin());

-- airports + models: any authenticated
create policy airports_select_auth on public.airports
  for select to authenticated using (true);

create policy airports_admin_write on public.airports
  for all to authenticated
  using (public.is_admin())
  with check (public.is_admin());

create policy aircraft_models_select_auth on public.aircraft_models
  for select to authenticated using (true);

create policy aircraft_models_admin_write on public.aircraft_models
  for all to authenticated
  using (public.is_admin())
  with check (public.is_admin());

-- operators
create policy operators_select on public.operators
  for select to authenticated
  using (
    public.is_admin()
    or id in (select public.operator_ids())
    or true -- authenticated can see operator profiles for listings
  );

create policy operators_admin_write on public.operators
  for all to authenticated
  using (public.is_admin())
  with check (public.is_admin());

create policy operators_member_update on public.operators
  for update to authenticated
  using (id in (select public.operator_ids()));

-- operator_members
create policy operator_members_select on public.operator_members
  for select to authenticated
  using (profile_id = auth.uid() or operator_id in (select public.operator_ids()) or public.is_admin());

create policy operator_members_admin_write on public.operator_members
  for all to authenticated
  using (public.is_admin())
  with check (public.is_admin());

-- aircraft
create policy aircraft_select_active_or_member on public.aircraft
  for select to authenticated
  using (
    is_active = true
    or operator_id in (select public.operator_ids())
    or public.is_admin()
  );

create policy aircraft_member_write on public.aircraft
  for all to authenticated
  using (operator_id in (select public.operator_ids()) or public.is_admin())
  with check (operator_id in (select public.operator_ids()) or public.is_admin());

-- aircraft_photos
create policy aircraft_photos_select on public.aircraft_photos
  for select to authenticated
  using (
    exists (
      select 1 from public.aircraft a
      where a.id = aircraft_id
        and (a.is_active or a.operator_id in (select public.operator_ids()) or public.is_admin())
    )
  );

create policy aircraft_photos_member_write on public.aircraft_photos
  for all to authenticated
  using (
    exists (
      select 1 from public.aircraft a
      where a.id = aircraft_id
        and (a.operator_id in (select public.operator_ids()) or public.is_admin())
    )
  )
  with check (
    exists (
      select 1 from public.aircraft a
      where a.id = aircraft_id
        and (a.operator_id in (select public.operator_ids()) or public.is_admin())
    )
  );

-- pricing rules
create policy pricing_rules_select on public.aircraft_pricing_rules
  for select to authenticated
  using (
    exists (
      select 1 from public.aircraft a
      where a.id = aircraft_id
        and (a.is_active or a.operator_id in (select public.operator_ids()) or public.is_admin())
    )
  );

create policy pricing_rules_member_write on public.aircraft_pricing_rules
  for all to authenticated
  using (
    exists (
      select 1 from public.aircraft a
      where a.id = aircraft_id
        and (a.operator_id in (select public.operator_ids()) or public.is_admin())
    )
  )
  with check (
    exists (
      select 1 from public.aircraft a
      where a.id = aircraft_id
        and (a.operator_id in (select public.operator_ids()) or public.is_admin())
    )
  );

-- availability
create policy availability_select on public.aircraft_availability
  for select to authenticated
  using (
    exists (
      select 1 from public.aircraft a
      where a.id = aircraft_id
        and (a.is_active or a.operator_id in (select public.operator_ids()) or public.is_admin())
    )
  );

create policy availability_member_write on public.aircraft_availability
  for all to authenticated
  using (
    exists (
      select 1 from public.aircraft a
      where a.id = aircraft_id
        and (a.operator_id in (select public.operator_ids()) or public.is_admin())
    )
  )
  with check (
    exists (
      select 1 from public.aircraft a
      where a.id = aircraft_id
        and (a.operator_id in (select public.operator_ids()) or public.is_admin())
    )
  );

-- empty legs
create policy empty_legs_select_published on public.empty_legs
  for select to authenticated
  using (
    status = 'published'
    or operator_id in (select public.operator_ids())
    or public.is_admin()
  );

create policy empty_legs_member_write on public.empty_legs
  for all to authenticated
  using (operator_id in (select public.operator_ids()) or public.is_admin())
  with check (operator_id in (select public.operator_ids()) or public.is_admin());

-- searches
create policy searches_own on public.searches
  for all to authenticated
  using (customer_id = auth.uid() or public.is_admin())
  with check (customer_id = auth.uid() or public.is_admin());

-- trip_requests
create policy trip_requests_customer on public.trip_requests
  for all to authenticated
  using (customer_id = auth.uid() or public.is_admin())
  with check (customer_id = auth.uid() or public.is_admin());

create policy trip_requests_operator_select on public.trip_requests
  for select to authenticated
  using (
    aircraft_id in (
      select a.id from public.aircraft a
      where a.operator_id in (select public.operator_ids())
    )
    or exists (
      select 1 from public.quotes q
      where q.trip_request_id = trip_requests.id
        and q.operator_id in (select public.operator_ids())
    )
  );

create policy trip_requests_operator_update on public.trip_requests
  for update to authenticated
  using (
    aircraft_id in (
      select a.id from public.aircraft a
      where a.operator_id in (select public.operator_ids())
    )
    or public.is_admin()
  );

-- quotes
create policy quotes_customer_select on public.quotes
  for select to authenticated
  using (
    exists (
      select 1 from public.trip_requests t
      where t.id = trip_request_id and t.customer_id = auth.uid()
    )
    or operator_id in (select public.operator_ids())
    or public.is_admin()
  );

create policy quotes_customer_update on public.quotes
  for update to authenticated
  using (
    exists (
      select 1 from public.trip_requests t
      where t.id = trip_request_id and t.customer_id = auth.uid()
    )
    or operator_id in (select public.operator_ids())
    or public.is_admin()
  );

create policy quotes_operator_insert on public.quotes
  for insert to authenticated
  with check (operator_id in (select public.operator_ids()) or public.is_admin());

-- bookings
create policy bookings_select on public.bookings
  for select to authenticated
  using (
    exists (
      select 1 from public.trip_requests t
      where t.id = trip_request_id and t.customer_id = auth.uid()
    )
    or exists (
      select 1 from public.quotes q
      where q.id = quote_id and q.operator_id in (select public.operator_ids())
    )
    or public.is_admin()
  );

create policy bookings_insert on public.bookings
  for insert to authenticated
  with check (
    exists (
      select 1 from public.trip_requests t
      where t.id = trip_request_id and t.customer_id = auth.uid()
    )
    or public.is_admin()
  );

create policy bookings_admin_update on public.bookings
  for update to authenticated
  using (public.is_admin() or exists (
    select 1 from public.quotes q
    where q.id = quote_id and q.operator_id in (select public.operator_ids())
  ));

-- passenger_profiles / preferences / passport
create policy passenger_profiles_own on public.passenger_profiles
  for all to authenticated
  using (customer_id = auth.uid() or public.is_admin())
  with check (customer_id = auth.uid() or public.is_admin());

create policy preferences_own on public.preferences
  for all to authenticated
  using (customer_id = auth.uid() or public.is_admin())
  with check (customer_id = auth.uid() or public.is_admin());

create policy passport_stamps_own on public.passport_stamps
  for all to authenticated
  using (customer_id = auth.uid() or public.is_admin())
  with check (customer_id = auth.uid() or public.is_admin());

-- platform fees: read for authenticated (operators need to resolve fees); write admin
create policy platform_fee_rules_select on public.platform_fee_rules
  for select to authenticated using (true);

create policy platform_fee_rules_admin on public.platform_fee_rules
  for all to authenticated
  using (public.is_admin())
  with check (public.is_admin());

-- future tables: own / admin stubs
create policy payments_admin on public.payments
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

create policy payouts_admin on public.payouts
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

create policy trip_documents_own on public.trip_documents
  for all to authenticated
  using (
    exists (
      select 1 from public.trip_requests t
      where t.id = trip_request_id and (t.customer_id = auth.uid() or public.is_admin())
    )
  )
  with check (
    exists (
      select 1 from public.trip_requests t
      where t.id = trip_request_id and (t.customer_id = auth.uid() or public.is_admin())
    )
  );

create policy trip_members_own on public.trip_members
  for all to authenticated
  using (profile_id = auth.uid() or public.is_admin())
  with check (profile_id = auth.uid() or public.is_admin());

create policy route_watches_own on public.route_watches
  for all to authenticated
  using (customer_id = auth.uid() or public.is_admin())
  with check (customer_id = auth.uid() or public.is_admin());

create policy notifications_own on public.notifications
  for all to authenticated
  using (profile_id = auth.uid() or public.is_admin())
  with check (profile_id = auth.uid() or public.is_admin());

-- ---------------------------------------------------------------------------
-- Storage: aircraft-photos bucket (public read)
-- ---------------------------------------------------------------------------
insert into storage.buckets (id, name, public)
values ('aircraft-photos', 'aircraft-photos', true)
on conflict (id) do update set public = true;

create policy aircraft_photos_storage_select on storage.objects
  for select to public
  using (bucket_id = 'aircraft-photos');

create policy aircraft_photos_storage_insert on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'aircraft-photos'
    and (public.is_admin() or exists (select 1 from public.operator_members where profile_id = auth.uid()))
  );

create policy aircraft_photos_storage_update on storage.objects
  for update to authenticated
  using (
    bucket_id = 'aircraft-photos'
    and (public.is_admin() or exists (select 1 from public.operator_members where profile_id = auth.uid()))
  );

create policy aircraft_photos_storage_delete on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'aircraft-photos'
    and (public.is_admin() or exists (select 1 from public.operator_members where profile_id = auth.uid()))
  );
