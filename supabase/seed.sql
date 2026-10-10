-- Reference seed. Safe for production.
-- Airports and aircraft models only.
--
-- Demo operators, fleet, accounts, and trips live in seed.demo.sql.
-- Local `supabase db reset` loads this file, then seed.demo.sql (config.toml).
-- Apply this file to production. Do not apply seed.demo.sql to production.
-- Staging may load both so the portals have data to exercise.

-- ---------------------------------------------------------------------------
-- Airports (from app/Hopp/Networking/MockCatalog.swift)
-- ---------------------------------------------------------------------------
insert into public.airports (id, icao, iata, name, city, region, country, time_zone, latitude, longitude) values
  ('11111111-1111-1111-1111-111111110001', 'KAUS', 'AUS', 'Austin-Bergstrom', 'Austin', 'Texas', 'USA', 'America/Chicago', 30.1945, -97.6699),
  ('11111111-1111-1111-1111-111111110002', 'MMSD', 'SJD', 'Los Cabos', 'Cabo', 'Baja California Sur', 'Mexico', 'America/Mazatlan', 23.1518, -109.721),
  ('11111111-1111-1111-1111-111111110003', 'KASE', 'ASE', 'Aspen/Pitkin County', 'Aspen', 'Colorado', 'USA', 'America/Denver', 39.2232, -106.869),
  ('11111111-1111-1111-1111-111111110004', 'KTEB', 'TEB', 'Teterboro', 'New York', 'New Jersey', 'USA', 'America/New_York', 40.8501, -74.0608),
  ('11111111-1111-1111-1111-111111110005', 'KVNY', 'VNY', 'Van Nuys', 'Los Angeles', 'California', 'USA', 'America/Los_Angeles', 34.2098, -118.49),
  ('11111111-1111-1111-1111-111111110006', 'KMIA', 'MIA', 'Miami International', 'Miami', 'Florida', 'USA', 'America/New_York', 25.7959, -80.2870),
  ('11111111-1111-1111-1111-111111110007', 'KPBI', 'PBI', 'Palm Beach', 'Palm Beach', 'Florida', 'USA', 'America/New_York', 26.6832, -80.0956),
  ('11111111-1111-1111-1111-111111110008', 'KLAS', 'LAS', 'Harry Reid', 'Las Vegas', 'Nevada', 'USA', 'America/Los_Angeles', 36.0840, -115.1537),
  ('11111111-1111-1111-1111-111111110009', 'EGLF', 'FAB', 'Farnborough', 'London', 'England', 'United Kingdom', 'Europe/London', 51.2758, -0.7763),
  ('11111111-1111-1111-1111-11111111000a', 'LFMN', 'NCE', 'Nice Côte d''Azur', 'Nice', 'Provence-Alpes-Côte d''Azur', 'France', 'Europe/Paris', 43.6584, 7.2179),
  ('11111111-1111-1111-1111-11111111000b', 'LEIB', 'IBZ', 'Ibiza', 'Ibiza', 'Balearic Islands', 'Spain', 'Europe/Madrid', 38.8729, 1.3731),
  ('11111111-1111-1111-1111-11111111000c', 'OMDB', 'DXB', 'Dubai International', 'Dubai', 'Dubai', 'UAE', 'Asia/Dubai', 25.2532, 55.3657),
  ('11111111-1111-1111-1111-11111111000d', 'MYNN', 'NAS', 'Lynden Pindling', 'Nassau', 'New Providence', 'Bahamas', 'America/Nassau', 25.0390, -77.4662),
  ('11111111-1111-1111-1111-11111111000e', 'RJTT', 'HND', 'Haneda', 'Tokyo', 'Tokyo', 'Japan', 'Asia/Tokyo', 35.5494, 139.7798),
  ('11111111-1111-1111-1111-11111111000f', 'KSDL', 'SDL', 'Scottsdale', 'Scottsdale', 'Arizona', 'USA', 'America/Phoenix', 33.6229, -111.911),
  ('11111111-1111-1111-1111-111111110010', 'KHPN', 'HPN', 'Westchester County', 'Westchester', 'New York', 'USA', 'America/New_York', 41.0670, -73.7076),
  ('11111111-1111-1111-1111-111111110011', 'KSFO', 'SFO', 'San Francisco International', 'San Francisco', 'California', 'USA', 'America/Los_Angeles', 37.6213, -122.3790),
  ('11111111-1111-1111-1111-111111110012', 'KBOS', 'BOS', 'Logan International', 'Boston', 'Massachusetts', 'USA', 'America/New_York', 42.3656, -71.0096),
  ('11111111-1111-1111-1111-111111110013', 'KORD', 'ORD', 'O''Hare International', 'Chicago', 'Illinois', 'USA', 'America/Chicago', 41.9742, -87.9073),
  ('11111111-1111-1111-1111-111111110014', 'KDEN', 'DEN', 'Denver International', 'Denver', 'Colorado', 'USA', 'America/Denver', 39.8561, -104.6737),
  ('11111111-1111-1111-1111-111111110015', 'KSNA', 'SNA', 'John Wayne', 'Santa Ana', 'California', 'USA', 'America/Los_Angeles', 33.6757, -117.8682),
  ('11111111-1111-1111-1111-111111110016', 'KOPF', 'OPF', 'Opa-locka Executive', 'Miami', 'Florida', 'USA', 'America/New_York', 25.9070, -80.2784),
  ('11111111-1111-1111-1111-111111110017', 'KFXE', 'FXE', 'Fort Lauderdale Executive', 'Fort Lauderdale', 'Florida', 'USA', 'America/New_York', 26.1973, -80.1707),
  ('11111111-1111-1111-1111-111111110018', 'LFPB', 'LBG', 'Paris Le Bourget', 'Paris', 'Île-de-France', 'France', 'Europe/Paris', 48.9694, 2.4414),
  ('11111111-1111-1111-1111-111111110019', 'LIML', 'LIN', 'Milano Linate', 'Milan', 'Lombardy', 'Italy', 'Europe/Rome', 45.4451, 9.2767),
  ('11111111-1111-1111-1111-11111111001a', 'LSZH', 'ZRH', 'Zurich Airport', 'Zurich', 'Zurich', 'Switzerland', 'Europe/Zurich', 47.4582, 8.5555),
  ('11111111-1111-1111-1111-11111111001b', 'KJAC', 'JAC', 'Jackson Hole', 'Jackson', 'Wyoming', 'USA', 'America/Denver', 43.6073, -110.7377),
  ('11111111-1111-1111-1111-11111111001c', 'KACK', 'ACK', 'Nantucket Memorial', 'Nantucket', 'Massachusetts', 'USA', 'America/New_York', 41.2531, -70.0602),
  ('11111111-1111-1111-1111-11111111001d', 'TNCM', 'SXM', 'Princess Juliana', 'St. Maarten', 'Sint Maarten', 'Sint Maarten', 'America/Lower_Princes', 18.0410, -63.1089),
  ('11111111-1111-1111-1111-11111111001e', 'EGGW', 'LTN', 'London Luton', 'London', 'England', 'United Kingdom', 'Europe/London', 51.8747, -0.3683),
  ('11111111-1111-1111-1111-11111111001f', 'LPPT', 'LIS', 'Humberto Delgado', 'Lisbon', 'Lisbon', 'Portugal', 'Europe/Lisbon', 38.7813, -9.1359)
on conflict (id) do nothing;

-- ---------------------------------------------------------------------------
-- Aircraft models (from MockCatalog.swift)
-- ---------------------------------------------------------------------------
insert into public.aircraft_models (id, manufacturer, name, category, range_nm, cruise_speed_ktas, typical_pax, max_pax, cabin_length_ft, cabin_width_ft, cabin_height_ft, baggage_cu_ft) values
  ('22222222-2222-2222-2222-222222220001', 'Embraer', 'Phenom 300', 'light', 2010, 453, 6, 8, 17.2, 5.1, 4.9, 76),
  ('22222222-2222-2222-2222-222222220002', 'Cessna', 'Citation CJ4', 'light', 2165, 451, 6, 8, 17.3, 4.8, 4.8, 77),
  ('22222222-2222-2222-2222-222222220003', 'Cessna', 'Citation X', 'midsize', 3460, 527, 8, 12, 25.2, 5.5, 5.7, 82),
  ('22222222-2222-2222-2222-222222220004', 'Bombardier', 'Challenger 350', 'super_midsize', 3200, 470, 8, 10, 25.2, 7.2, 6.0, 106),
  ('22222222-2222-2222-2222-222222220005', 'Embraer', 'Praetor 600', 'super_midsize', 4018, 466, 8, 12, 24.1, 6.8, 6.0, 155),
  ('22222222-2222-2222-2222-222222220006', 'Dassault', 'Falcon 8X', 'heavy', 6450, 488, 12, 16, 42.7, 7.7, 6.2, 140),
  ('22222222-2222-2222-2222-222222220007', 'Gulfstream', 'G450', 'heavy', 4350, 476, 12, 16, 40.4, 7.3, 6.2, 169),
  ('22222222-2222-2222-2222-222222220008', 'Gulfstream', 'G650', 'ultra_long_range', 7000, 516, 13, 19, 46.8, 8.2, 6.3, 195)
on conflict (id) do nothing;
