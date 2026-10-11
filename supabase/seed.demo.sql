-- Demo seed. Do not apply to production.
-- Operators, fleet, empty legs, operator-scoped fee overrides, accounts, and trips.
-- Depends on airports, aircraft models, and the global platform fee from seed.sql.
-- Demo logins use password: koria-demo
-- The operator portal (/admin/operators) is still the real onboarding path.

-- Optional local demo operator (portal /admin/operators is the real path).
insert into public.operators (
  id, name, code, city, home_airport_id,
  legal_name, dba, certificate_number, certificate_type,
  operational_control_disclosure, contact_email, contact_phone, default_fee_bps
) values (
  '44444444-4444-4444-4444-444444440001',
  'Lone Star Jet',
  'LSJ',
  'Austin',
  '11111111-1111-1111-1111-111111110001',
  'Lone Star Jet LLC',
  'Lone Star Jet',
  'LSJ-135-001',
  'Part 135',
  'Lone Star Jet LLC has operational control of all flights operated under its air carrier certificate.',
  'ops@lonestarjet.example',
  '+1-512-555-0100',
  null
)
on conflict (id) do nothing;

insert into public.operators (
  id, name, code, city, home_airport_id,
  legal_name, dba, certificate_number, certificate_type,
  operational_control_disclosure, contact_email, contact_phone, default_fee_bps
) values
  (
    '44444444-4444-4444-4444-444444440002',
    'Northline', 'NLN', 'Austin', '11111111-1111-1111-1111-111111110001',
    'Northline Aviation LLC', 'Northline', 'NLN-135-0142', 'Part 135',
    'Northline Aviation LLC has operational control of all flights operated under its air carrier certificate.',
    'ops@northline.example', '+1-512-555-0142', null
  ),
  (
    '44444444-4444-4444-4444-444444440003',
    'Atelier Jet', 'ATJ', 'Teterboro', '11111111-1111-1111-1111-111111110004',
    'Atelier Jet Inc.', 'Atelier Jet', 'ATJ-135-2201', 'Part 135',
    'Atelier Jet Inc. has operational control of all flights operated under its air carrier certificate.',
    'ops@atelier.example', '+1-201-555-2201', null
  ),
  (
    '44444444-4444-4444-4444-444444440004',
    'Caldera', 'CDA', 'Van Nuys', '11111111-1111-1111-1111-111111110005',
    'Caldera Air LLC', 'Caldera', 'CDA-135-0884', 'Part 135',
    'Caldera Air LLC has operational control of all flights operated under its air carrier certificate.',
    'ops@caldera.example', '+1-818-555-0884', null
  ),
  (
    '44444444-4444-4444-4444-444444440005',
    'Solstice Aviation', 'SOL', 'Miami', '11111111-1111-1111-1111-111111110006',
    'Solstice Aviation Inc.', 'Solstice', 'SOL-135-3310', 'Part 135',
    'Solstice Aviation Inc. has operational control of all flights operated under its air carrier certificate.',
    'ops@solstice.example', '+1-305-555-3310', 800
  ),
  (
    '44444444-4444-4444-4444-444444440006',
    'Crown Air', 'CRN', 'London', '11111111-1111-1111-1111-111111110009',
    'Crown Air Ltd', 'Crown Air', 'CRN-135-UK-019', 'Part 135',
    'Crown Air Ltd has operational control of all flights operated under its air carrier certificate.',
    'ops@crownair.example', '+44-20-7946-0019', null
  ),
  (
    '44444444-4444-4444-4444-444444440007',
    'Atlantic Ridge', 'ARG', 'Farnborough', '11111111-1111-1111-1111-111111110009',
    'Atlantic Ridge Aviation Ltd', 'Atlantic Ridge', 'ARG-135-UK-044', 'Part 135',
    'Atlantic Ridge Aviation Ltd has operational control of all flights operated under its air carrier certificate.',
    'ops@atlanticridge.example', '+44-1252-555-044', null
  )
on conflict (id) do nothing;

-- Crown Air uses a 12% operator-scoped rule. Solstice uses default_fee_bps = 800 (8%).
insert into public.platform_fee_rules (id, scope, operator_id, bps, effective_from)
values (
  '33333333-3333-3333-3333-333333330002',
  'operator',
  '44444444-4444-4444-4444-444444440006',
  1200,
  now()
)
on conflict (id) do nothing;

-- ---------------------------------------------------------------------------
-- Fleet (tails from MockCatalog.swift, plus two Lone Star aircraft)
-- ---------------------------------------------------------------------------
insert into public.aircraft (
  id, operator_id, model_id, tail_number, year, seating,
  interior_configuration, baggage_cu_ft, wifi, lavatory, pets, golf, skis,
  cabin_notes, home_base_id, is_active, pricing_mode_default, pet_policy
) values
  ('55555555-5555-5555-5555-555555550001', '44444444-4444-4444-4444-444444440002', '22222222-2222-2222-2222-222222220001', 'N300NL', 2021, 7, 'Club 7', 76, true, true, true, false, false, 'Club four with a belted lav. Quiet, fast light jet for regional work.', '11111111-1111-1111-1111-111111110001', true, 'live', 'Pets in cabin, two carriers.'),
  ('55555555-5555-5555-5555-555555550002', '44444444-4444-4444-4444-444444440004', '22222222-2222-2222-2222-222222220002', 'N414CJ', 2019, 6, 'Club 6', 77, true, true, false, true, true, 'High-altitude capable. Strong for mountain airports.', '11111111-1111-1111-1111-111111110005', true, 'estimated', 'Pets by prior approval.'),
  ('55555555-5555-5555-5555-555555550003', '44444444-4444-4444-4444-444444440003', '22222222-2222-2222-2222-222222220003', 'N910XX', 2018, 8, 'Club 8', 82, true, true, false, false, false, 'The fastest civilian jet in the catalog. Coast-to-coast without compromise.', '11111111-1111-1111-1111-111111110004', true, 'live', 'Pets in cabin.'),
  ('55555555-5555-5555-5555-555555550004', '44444444-4444-4444-4444-444444440005', '22222222-2222-2222-2222-222222220004', 'N350CD', 2022, 9, 'Club 9', 106, true, true, true, false, false, 'Stand-up cabin, conference four, and a proper galley for longer sectors.', '11111111-1111-1111-1111-111111110006', true, 'live', 'Pets in cabin.'),
  ('55555555-5555-5555-5555-555555550005', '44444444-4444-4444-4444-444444440002', '22222222-2222-2222-2222-222222220005', 'N600PR', 2023, 9, 'Club 9', 155, true, true, false, false, false, 'Transcontinental range in a super-midsize cabin. Ka-band Wi-Fi.', '11111111-1111-1111-1111-111111110001', true, 'estimated', 'Pets in cabin with notice.'),
  ('55555555-5555-5555-5555-555555550006', '44444444-4444-4444-4444-444444440007', '22222222-2222-2222-2222-222222220006', 'G-FDXX', 2020, 14, 'Club 14', 140, true, true, true, false, false, 'Three-lounge cabin. Quiet, long-legged, and built for overnight Europe.', '11111111-1111-1111-1111-111111110009', true, 'estimated', 'Pets in cabin.'),
  ('55555555-5555-5555-5555-555555550007', '44444444-4444-4444-4444-444444440003', '22222222-2222-2222-2222-222222220007', 'N450AT', 2016, 13, 'Club 13', 169, true, true, false, true, true, 'Forward galley, crew rest, and a cabin that still feels current.', '11111111-1111-1111-1111-111111110004', true, 'quote_required', 'Pets by arrangement.'),
  ('55555555-5555-5555-5555-555555550008', '44444444-4444-4444-4444-444444440006', '22222222-2222-2222-2222-222222220008', 'N650CR', 2021, 14, 'Club 14', 195, true, true, true, false, false, 'Ultra-long range. Shower, full berthing, and a cabin designed for the ocean to disappear.', '11111111-1111-1111-1111-111111110009', true, 'live', 'Pets in cabin, dedicated handler on request.'),
  ('55555555-5555-5555-5555-555555550009', '44444444-4444-4444-4444-444444440001', '22222222-2222-2222-2222-222222220001', 'N135LS', 2022, 7, 'Club 7', 76, true, true, true, false, true, 'Austin-based light jet. Ski tubes and a belted lav.', '11111111-1111-1111-1111-111111110001', true, 'live', 'Pets in cabin.'),
  ('55555555-5555-5555-5555-55555555000a', '44444444-4444-4444-4444-444444440001', '22222222-2222-2222-2222-222222220007', 'N450LS', 2017, 12, 'Club 12', 169, true, true, false, true, true, 'Heavy cabin held for quote. Forward galley, crew rest.', '11111111-1111-1111-1111-111111110001', true, 'quote_required', 'Pets by arrangement.')
on conflict (id) do nothing;

insert into public.aircraft_pricing_rules (id, aircraft_id, hourly_rate, minimum, positioning_fee, mode) values
  ('cccccccc-cccc-cccc-cccc-cccccccccc01', '55555555-5555-5555-5555-555555550001', 4200, 8500, 1500, 'live'),
  ('cccccccc-cccc-cccc-cccc-cccccccccc02', '55555555-5555-5555-5555-555555550002', 3900, 8000, 1200, 'estimated'),
  ('cccccccc-cccc-cccc-cccc-cccccccccc03', '55555555-5555-5555-5555-555555550003', 6200, 12000, 2000, 'live'),
  ('cccccccc-cccc-cccc-cccc-cccccccccc04', '55555555-5555-5555-5555-555555550004', 7800, 15000, 2500, 'live'),
  ('cccccccc-cccc-cccc-cccc-cccccccccc05', '55555555-5555-5555-5555-555555550005', 7200, 14000, 2000, 'estimated'),
  ('cccccccc-cccc-cccc-cccc-cccccccccc06', '55555555-5555-5555-5555-555555550006', 9800, 22000, 4000, 'estimated'),
  ('cccccccc-cccc-cccc-cccc-cccccccccc07', '55555555-5555-5555-5555-555555550007', null, null, null, 'quote_required'),
  ('cccccccc-cccc-cccc-cccc-cccccccccc08', '55555555-5555-5555-5555-555555550008', 12500, 28000, 5000, 'live'),
  ('cccccccc-cccc-cccc-cccc-cccccccccc09', '55555555-5555-5555-5555-555555550009', 3800, 7500, 1000, 'live'),
  ('cccccccc-cccc-cccc-cccc-cccccccccc0a', '55555555-5555-5555-5555-55555555000a', null, null, null, 'quote_required')
on conflict (id) do nothing;

-- Open availability for the next 120 days, plus a short maintenance block on each tail.
insert into public.aircraft_availability (id, aircraft_id, starts_at, ends_at, kind, based_at_id, notes) values
  ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbb01', '55555555-5555-5555-5555-555555550001', now(), now() + interval '120 days', 'available', '11111111-1111-1111-1111-111111110001', 'Based Austin'),
  ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbb02', '55555555-5555-5555-5555-555555550001', now() + interval '40 days', now() + interval '43 days', 'blocked', '11111111-1111-1111-1111-111111110001', 'Scheduled maintenance'),
  ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbb03', '55555555-5555-5555-5555-555555550002', now(), now() + interval '120 days', 'available', '11111111-1111-1111-1111-111111110005', 'Based Van Nuys'),
  ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbb04', '55555555-5555-5555-5555-555555550002', now() + interval '18 days', now() + interval '20 days', 'blocked', '11111111-1111-1111-1111-111111110005', 'Avionics check'),
  ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbb05', '55555555-5555-5555-5555-555555550003', now(), now() + interval '120 days', 'available', '11111111-1111-1111-1111-111111110004', 'Based Teterboro'),
  ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbb06', '55555555-5555-5555-5555-555555550003', now() + interval '28 days', now() + interval '30 days', 'blocked', '11111111-1111-1111-1111-111111110004', 'Interior refresh'),
  ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbb07', '55555555-5555-5555-5555-555555550004', now(), now() + interval '120 days', 'available', '11111111-1111-1111-1111-111111110006', 'Based Miami'),
  ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbb08', '55555555-5555-5555-5555-555555550004', now() + interval '50 days', now() + interval '52 days', 'blocked', '11111111-1111-1111-1111-111111110006', 'Engine borescope'),
  ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbb09', '55555555-5555-5555-5555-555555550005', now(), now() + interval '120 days', 'available', '11111111-1111-1111-1111-111111110001', 'Based Austin'),
  ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbb0a', '55555555-5555-5555-5555-555555550005', now() + interval '12 days', now() + interval '14 days', 'blocked', '11111111-1111-1111-1111-111111110001', 'Crew training'),
  ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbb0b', '55555555-5555-5555-5555-555555550006', now(), now() + interval '120 days', 'available', '11111111-1111-1111-1111-111111110009', 'Based Farnborough'),
  ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbb0c', '55555555-5555-5555-5555-555555550006', now() + interval '60 days', now() + interval '63 days', 'blocked', '11111111-1111-1111-1111-111111110009', 'Heavy check'),
  ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbb0d', '55555555-5555-5555-5555-555555550007', now(), now() + interval '120 days', 'available', '11111111-1111-1111-1111-111111110004', 'Based Teterboro'),
  ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbb0e', '55555555-5555-5555-5555-555555550007', now() + interval '22 days', now() + interval '24 days', 'blocked', '11111111-1111-1111-1111-111111110004', 'Paint touch-up'),
  ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbb0f', '55555555-5555-5555-5555-555555550008', now(), now() + interval '120 days', 'available', '11111111-1111-1111-1111-111111110009', 'Based Farnborough'),
  ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbb10', '55555555-5555-5555-5555-555555550008', now() + interval '35 days', now() + interval '37 days', 'blocked', '11111111-1111-1111-1111-111111110009', 'Cabin Wi-Fi upgrade'),
  ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbb11', '55555555-5555-5555-5555-555555550009', now(), now() + interval '120 days', 'available', '11111111-1111-1111-1111-111111110001', 'Based Austin'),
  ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbb12', '55555555-5555-5555-5555-555555550009', now() + interval '8 days', now() + interval '9 days', 'blocked', '11111111-1111-1111-1111-111111110001', 'Owner hold'),
  ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbb13', '55555555-5555-5555-5555-55555555000a', now(), now() + interval '120 days', 'available', '11111111-1111-1111-1111-111111110001', 'Based Austin'),
  ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbb14', '55555555-5555-5555-5555-55555555000a', now() + interval '70 days', now() + interval '74 days', 'blocked', '11111111-1111-1111-1111-111111110001', 'C-check')
on conflict (id) do nothing;

-- ---------------------------------------------------------------------------
-- Empty legs
-- ---------------------------------------------------------------------------
insert into public.empty_legs (
  id, operator_id, aircraft_id, origin_id, destination_id, depart_at,
  seats_available, whole_aircraft, price, pricing_mode, notes, status
) values
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaa01', '44444444-4444-4444-4444-444444440003', '55555555-5555-5555-5555-555555550003', '11111111-1111-1111-1111-111111110004', '11111111-1111-1111-1111-111111110007', now() + interval '2 days', 8, true, 18500, 'live', 'Repositioning south. Live price, same-day confirmation.', 'published'),
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaa02', '44444444-4444-4444-4444-444444440005', '55555555-5555-5555-5555-555555550004', '11111111-1111-1111-1111-111111110005', '11111111-1111-1111-1111-111111110003', now() + interval '5 days', 8, true, 14200, 'live', 'Mountain-capable crew. Ski bags welcome.', 'published'),
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaa03', '44444444-4444-4444-4444-444444440002', '55555555-5555-5555-5555-555555550001', '11111111-1111-1111-1111-111111110001', '11111111-1111-1111-1111-111111110002', now() + interval '3 days', 6, true, 9800, 'live', 'Friday afternoon empty leg. Light cabin, live price.', 'published'),
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaa04', '44444444-4444-4444-4444-444444440007', '55555555-5555-5555-5555-555555550006', '11111111-1111-1111-1111-111111110009', '11111111-1111-1111-1111-11111111000a', now() + interval '6 days', 12, true, 22000, 'estimated', 'European reposition. Estimated until the operator confirms slots.', 'published'),
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaa05', '44444444-4444-4444-4444-444444440003', '55555555-5555-5555-5555-555555550007', '11111111-1111-1111-1111-111111110006', '11111111-1111-1111-1111-11111111000d', now() + interval '4 days', 10, true, null, 'quote_required', 'Island sector. Cabin is available; operator will quote fuel and handling.', 'published'),
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaa06', '44444444-4444-4444-4444-444444440006', '55555555-5555-5555-5555-555555550008', '11111111-1111-1111-1111-111111110009', '11111111-1111-1111-1111-11111111000c', now() + interval '9 days', 12, true, 48000, 'estimated', 'Eastbound ultra-long-range reposition via a fuel stop if winds require.', 'published'),
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaa07', '44444444-4444-4444-4444-444444440001', '55555555-5555-5555-5555-555555550009', '11111111-1111-1111-1111-111111110001', '11111111-1111-1111-1111-111111110008', now() + interval '4 days', 6, true, 7200, 'live', 'Austin to Las Vegas after a charter drop.', 'published'),
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaa08', '44444444-4444-4444-4444-444444440002', '55555555-5555-5555-5555-555555550005', '11111111-1111-1111-1111-111111110001', '11111111-1111-1111-1111-111111110006', now() + interval '6 days', 8, true, 11500, 'live', 'Super-midsize empty leg, whole aircraft.', 'published'),
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaa09', '44444444-4444-4444-4444-444444440004', '55555555-5555-5555-5555-555555550002', '11111111-1111-1111-1111-111111110005', '11111111-1111-1111-1111-111111110008', now() + interval '8 days', 6, true, 6400, 'estimated', 'Withdrawn after the owner kept the airplane.', 'withdrawn'),
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaa0a', '44444444-4444-4444-4444-444444440005', '55555555-5555-5555-5555-555555550004', '11111111-1111-1111-1111-111111110006', '11111111-1111-1111-1111-111111110007', now() - interval '2 days', 8, true, 8900, 'live', 'Booked Miami to Palm Beach hop.', 'booked')
on conflict (id) do nothing;

-- ---------------------------------------------------------------------------
-- Demo accounts. Password for every one of these is: koria-demo
-- ---------------------------------------------------------------------------
do $$
declare
  rec record;
begin
  for rec in
    select *
    from (
      values
        ('66666666-6666-6666-6666-666666660001'::uuid, 'alex.rivera@koria.example', 'Alex Rivera', 'customer'::public.user_role, 'approved'::public.access_status),
        ('66666666-6666-6666-6666-666666660002'::uuid, 'sam.chen@koria.example', 'Sam Chen', 'customer', 'approved'),
        ('66666666-6666-6666-6666-666666660003'::uuid, 'jordan.hale@koria.example', 'Jordan Hale', 'customer', 'requested'),
        ('66666666-6666-6666-6666-666666660004'::uuid, 'maya.ortiz@northline.example', 'Maya Ortiz', 'operator', 'approved'),
        ('66666666-6666-6666-6666-666666660005'::uuid, 'luca.moretti@atelier.example', 'Luca Moretti', 'operator', 'approved'),
        ('66666666-6666-6666-6666-666666660006'::uuid, 'rafa.vega@caldera.example', 'Rafa Vega', 'operator', 'approved'),
        ('66666666-6666-6666-6666-666666660007'::uuid, 'isla.bennett@solstice.example', 'Isla Bennett', 'operator', 'approved'),
        ('66666666-6666-6666-6666-666666660008'::uuid, 'owen.clarke@crownair.example', 'Owen Clarke', 'operator', 'approved'),
        ('66666666-6666-6666-6666-666666660009'::uuid, 'emma.laurent@atlanticridge.example', 'Emma Laurent', 'operator', 'approved'),
        ('66666666-6666-6666-6666-66666666000a'::uuid, 'casey.brooks@lonestarjet.example', 'Casey Brooks', 'operator', 'approved')
    ) as t(id, email, display_name, role, access_status)
  loop
    insert into auth.users (
      instance_id, id, aud, role, email, encrypted_password,
      email_confirmed_at, raw_app_meta_data, raw_user_meta_data,
      created_at, updated_at,
      confirmation_token, email_change, email_change_token_new, recovery_token
    ) values (
      '00000000-0000-0000-0000-000000000000',
      rec.id,
      'authenticated',
      'authenticated',
      rec.email,
      extensions.crypt('koria-demo', extensions.gen_salt('bf')),
      now(),
      '{"provider":"email","providers":["email"]}'::jsonb,
      jsonb_build_object('display_name', rec.display_name),
      now(),
      now(),
      '', '', '', ''
    )
    on conflict (id) do nothing;

    insert into auth.identities (
      id, user_id, provider_id, identity_data, provider, last_sign_in_at, created_at, updated_at
    )
    select
      gen_random_uuid(),
      rec.id,
      rec.id::text,
      jsonb_build_object('sub', rec.id::text, 'email', rec.email),
      'email',
      now(), now(), now()
    where not exists (
      select 1 from auth.identities i
      where i.provider = 'email' and i.provider_id = rec.id::text
    );

    update public.profiles
    set display_name = rec.display_name,
        role = rec.role,
        access_status = rec.access_status,
        email = rec.email
    where id = rec.id;
  end loop;
end $$;

insert into public.operator_members (id, operator_id, profile_id, role) values
  ('abababab-abab-abab-abab-ababababab01', '44444444-4444-4444-4444-444444440002', '66666666-6666-6666-6666-666666660004', 'admin'),
  ('abababab-abab-abab-abab-ababababab02', '44444444-4444-4444-4444-444444440003', '66666666-6666-6666-6666-666666660005', 'admin'),
  ('abababab-abab-abab-abab-ababababab03', '44444444-4444-4444-4444-444444440004', '66666666-6666-6666-6666-666666660006', 'admin'),
  ('abababab-abab-abab-abab-ababababab04', '44444444-4444-4444-4444-444444440005', '66666666-6666-6666-6666-666666660007', 'admin'),
  ('abababab-abab-abab-abab-ababababab05', '44444444-4444-4444-4444-444444440006', '66666666-6666-6666-6666-666666660008', 'admin'),
  ('abababab-abab-abab-abab-ababababab06', '44444444-4444-4444-4444-444444440007', '66666666-6666-6666-6666-666666660009', 'admin'),
  ('abababab-abab-abab-abab-ababababab07', '44444444-4444-4444-4444-444444440001', '66666666-6666-6666-6666-66666666000a', 'admin')
on conflict (id) do nothing;

insert into public.access_requests (id, user_id, email, note, status, invite_code) values
  ('13131313-1313-1313-1313-131313130001', '66666666-6666-6666-6666-666666660001', 'alex.rivera@koria.example', 'Founding member, Austin.', 'approved', null),
  ('13131313-1313-1313-1313-131313130002', '66666666-6666-6666-6666-666666660002', 'sam.chen@koria.example', 'Referred by Alex Rivera.', 'approved', null),
  ('13131313-1313-1313-1313-131313130003', '66666666-6666-6666-6666-666666660003', 'jordan.hale@koria.example', 'Asked for access after the Aspen trip last winter.', 'requested', null),
  ('13131313-1313-1313-1313-131313130004', null, 'priya.shah@example.com', 'Invited from the waitlist.', 'invited', 'KORIA-PRIYA'),
  ('13131313-1313-1313-1313-131313130005', null, 'noah.kim@example.com', 'Wants weekday Teterboro to Palm Beach.', 'requested', null),
  ('13131313-1313-1313-1313-131313130006', null, 'old.lead@example.com', 'Could not verify the referral.', 'declined', null)
on conflict (id) do nothing;

-- ---------------------------------------------------------------------------
-- Trips, quotes, bookings
-- Fee math: global 10%, Solstice operator default 8%, Crown operator rule 12%.
-- ---------------------------------------------------------------------------
insert into public.trip_requests (
  id, customer_id, origin_id, destination_id, depart_at, return_at,
  passengers, prefs, flexible_days, nearby_airports, aircraft_id, empty_leg_id,
  status, notes, fbo
) values
  ('77777777-7777-7777-7777-777777770001', '66666666-6666-6666-6666-666666660001', '11111111-1111-1111-1111-111111110001', '11111111-1111-1111-1111-111111110002', now() + interval '10 days', now() + interval '13 days', 4, '{"pets": false, "wifi": true}'::jsonb, 1, false, null, 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaa03', 'requested', 'Weekend in Cabo. Prefer a light jet if the empty leg is gone.', 'Signature Flight Support'),
  ('77777777-7777-7777-7777-777777770002', '66666666-6666-6666-6666-666666660001', '11111111-1111-1111-1111-111111110004', '11111111-1111-1111-1111-111111110007', now() + interval '14 days', null, 6, '{"wifi": true}'::jsonb, 0, true, '55555555-5555-5555-5555-555555550003', null, 'quote_received', 'One-way to Palm Beach. Nearby airports are fine.', 'Meridian Teterboro'),
  ('77777777-7777-7777-7777-777777770003', '66666666-6666-6666-6666-666666660001', '11111111-1111-1111-1111-111111110005', '11111111-1111-1111-1111-111111110003', now() + interval '21 days', now() + interval '25 days', 5, '{"skis": true, "wifi": true}'::jsonb, 2, false, '55555555-5555-5555-5555-555555550004', null, 'awaiting_payment', 'Ski week. Bags for five.', 'Clay Lacy'),
  ('77777777-7777-7777-7777-777777770004', '66666666-6666-6666-6666-666666660001', '11111111-1111-1111-1111-111111110006', '11111111-1111-1111-1111-11111111000d', now() + interval '18 days', now() + interval '21 days', 8, '{"pets": false}'::jsonb, 0, false, '55555555-5555-5555-5555-555555550007', null, 'confirmed', 'Nassau for a long weekend.', 'Signature Miami'),
  ('77777777-7777-7777-7777-777777770005', '66666666-6666-6666-6666-666666660001', '11111111-1111-1111-1111-111111110001', '11111111-1111-1111-1111-111111110008', now() + interval '7 days', null, 4, '{"wifi": true}'::jsonb, 0, false, '55555555-5555-5555-5555-555555550001', null, 'upcoming', 'Evening departure, back the next morning is not required.', 'Signature Austin'),
  ('77777777-7777-7777-7777-777777770006', '66666666-6666-6666-6666-666666660001', '11111111-1111-1111-1111-111111110009', '11111111-1111-1111-1111-11111111000a', now() - interval '20 days', now() - interval '16 days', 10, '{"wifi": true}'::jsonb, 0, false, '55555555-5555-5555-5555-555555550006', null, 'completed', 'Farnborough to Nice. Completed last month.', 'Farnborough Airport'),
  ('77777777-7777-7777-7777-777777770007', '66666666-6666-6666-6666-666666660001', '11111111-1111-1111-1111-11111111000f', '11111111-1111-1111-1111-111111110010', now() + interval '12 days', null, 3, '{}'::jsonb, 0, false, null, null, 'cancelled', 'Plans changed.', 'Scottsdale Air Center'),
  ('77777777-7777-7777-7777-777777770008', '66666666-6666-6666-6666-666666660002', '11111111-1111-1111-1111-111111110006', '11111111-1111-1111-1111-11111111000c', now() + interval '40 days', now() + interval '47 days', 12, '{"wifi": true}'::jsonb, 3, false, '55555555-5555-5555-5555-555555550008', null, 'declined', 'Miami to Dubai. Quote came back above the budget.', 'Signature Miami'),
  ('77777777-7777-7777-7777-777777770009', '66666666-6666-6666-6666-666666660002', '11111111-1111-1111-1111-111111110010', '11111111-1111-1111-1111-11111111000b', now() + interval '30 days', now() + interval '34 days', 2, '{"wifi": true}'::jsonb, 1, true, null, null, 'requested', 'Westchester to Ibiza. Open to Le Bourget as a technical stop.', 'Westchester County'),
  ('77777777-7777-7777-7777-77777777000a', '66666666-6666-6666-6666-666666660002', '11111111-1111-1111-1111-111111110001', '11111111-1111-1111-1111-111111110006', now() + interval '8 days', null, 4, '{"wifi": true}'::jsonb, 0, false, '55555555-5555-5555-5555-555555550005', null, 'quote_received', 'Austin to Miami, one way.', 'Signature Austin'),
  ('77777777-7777-7777-7777-77777777000b', '66666666-6666-6666-6666-666666660002', '11111111-1111-1111-1111-111111110001', '11111111-1111-1111-1111-111111110002', now() - interval '40 days', now() - interval '36 days', 2, '{}'::jsonb, 0, false, '55555555-5555-5555-5555-555555550009', null, 'completed', 'First trip on KORIA.', 'Signature Austin')
on conflict (id) do nothing;

insert into public.quotes (
  id, trip_request_id, operator_id, aircraft_id,
  operator_amount, platform_fee_amount, taxes_amount, customer_total,
  currency, valid_until, notes, status, carrier_disclosure_snapshot, pricing_mode
) values
  ('88888888-8888-8888-8888-888888880002', '77777777-7777-7777-7777-777777770002', '44444444-4444-4444-4444-444444440003', '55555555-5555-5555-5555-555555550003', 24600, 2460, 0, 27060, 'USD', now() + interval '3 days', 'Citation X, live hourly. Includes positioning back to Teterboro.', 'pending', '{"legal_name":"Atelier Jet Inc.","dba":"Atelier Jet","certificate_number":"ATJ-135-2201","certificate_type":"Part 135"}'::jsonb, 'live'),
  ('88888888-8888-8888-8888-888888880003', '77777777-7777-7777-7777-777777770003', '44444444-4444-4444-4444-444444440005', '55555555-5555-5555-5555-555555550004', 18900, 1512, 0, 20412, 'USD', now() + interval '5 days', 'Challenger 350. Solstice fee is 8%. Ski tubes confirmed.', 'accepted', '{"legal_name":"Solstice Aviation Inc.","dba":"Solstice","certificate_number":"SOL-135-3310","certificate_type":"Part 135"}'::jsonb, 'live'),
  ('88888888-8888-8888-8888-888888880004', '77777777-7777-7777-7777-777777770004', '44444444-4444-4444-4444-444444440003', '55555555-5555-5555-5555-555555550007', 32000, 3200, 0, 35200, 'USD', now() + interval '2 days', 'G450 quoted after fuel and Nassau handling.', 'accepted', '{"legal_name":"Atelier Jet Inc.","dba":"Atelier Jet","certificate_number":"ATJ-135-2201","certificate_type":"Part 135"}'::jsonb, 'quote_required'),
  ('88888888-8888-8888-8888-888888880005', '77777777-7777-7777-7777-777777770005', '44444444-4444-4444-4444-444444440002', '55555555-5555-5555-5555-555555550001', 14800, 1480, 0, 16280, 'USD', now() + interval '2 days', 'Phenom 300, one way.', 'accepted', '{"legal_name":"Northline Aviation LLC","dba":"Northline","certificate_number":"NLN-135-0142","certificate_type":"Part 135"}'::jsonb, 'live'),
  ('88888888-8888-8888-8888-888888880006', '77777777-7777-7777-7777-777777770006', '44444444-4444-4444-4444-444444440007', '55555555-5555-5555-5555-555555550006', 22000, 2200, 0, 24200, 'USD', now() - interval '25 days', 'Falcon 8X, round trip estimate honored.', 'accepted', '{"legal_name":"Atlantic Ridge Aviation Ltd","dba":"Atlantic Ridge","certificate_number":"ARG-135-UK-044","certificate_type":"Part 135"}'::jsonb, 'estimated'),
  ('88888888-8888-8888-8888-888888880008', '77777777-7777-7777-7777-777777770008', '44444444-4444-4444-4444-444444440006', '55555555-5555-5555-5555-555555550008', 64000, 7680, 0, 71680, 'USD', now() + interval '10 days', 'G650. Crown fee is 12%. Customer declined.', 'declined', '{"legal_name":"Crown Air Ltd","dba":"Crown Air","certificate_number":"CRN-135-UK-019","certificate_type":"Part 135"}'::jsonb, 'live'),
  ('88888888-8888-8888-8888-88888888000a', '77777777-7777-7777-7777-77777777000a', '44444444-4444-4444-4444-444444440002', '55555555-5555-5555-5555-555555550005', 19800, 1980, 0, 21780, 'USD', now() + interval '4 days', 'Praetor 600 estimated. Awaiting the customer.', 'pending', '{"legal_name":"Northline Aviation LLC","dba":"Northline","certificate_number":"NLN-135-0142","certificate_type":"Part 135"}'::jsonb, 'estimated'),
  ('88888888-8888-8888-8888-88888888000b', '77777777-7777-7777-7777-77777777000b', '44444444-4444-4444-4444-444444440001', '55555555-5555-5555-5555-555555550009', 9600, 960, 0, 10560, 'USD', now() - interval '45 days', 'Phenom empty-leg rate, honored.', 'accepted', '{"legal_name":"Lone Star Jet LLC","dba":"Lone Star Jet","certificate_number":"LSJ-135-001","certificate_type":"Part 135"}'::jsonb, 'live')
on conflict (id) do nothing;

insert into public.bookings (
  id, trip_request_id, quote_id, status,
  operator_amount, platform_fee_amount, taxes_amount, customer_total, currency,
  operating_carrier_legal_name, operating_carrier_dba, certificate_number,
  broker_role_disclosure, fbo
) values
  ('99999999-9999-9999-9999-999999990003', '77777777-7777-7777-7777-777777770003', '88888888-8888-8888-8888-888888880003', 'pending', 18900, 1512, 0, 20412, 'USD', 'Solstice Aviation Inc.', 'Solstice', 'SOL-135-3310', 'KORIA is the broker. Solstice Aviation Inc. has operational control.', 'Clay Lacy'),
  ('99999999-9999-9999-9999-999999990004', '77777777-7777-7777-7777-777777770004', '88888888-8888-8888-8888-888888880004', 'confirmed', 32000, 3200, 0, 35200, 'USD', 'Atelier Jet Inc.', 'Atelier Jet', 'ATJ-135-2201', 'KORIA is the broker. Atelier Jet Inc. has operational control.', 'Signature Miami'),
  ('99999999-9999-9999-9999-999999990005', '77777777-7777-7777-7777-777777770005', '88888888-8888-8888-8888-888888880005', 'confirmed', 14800, 1480, 0, 16280, 'USD', 'Northline Aviation LLC', 'Northline', 'NLN-135-0142', 'KORIA is the broker. Northline Aviation LLC has operational control.', 'Signature Austin'),
  ('99999999-9999-9999-9999-999999990006', '77777777-7777-7777-7777-777777770006', '88888888-8888-8888-8888-888888880006', 'completed', 22000, 2200, 0, 24200, 'USD', 'Atlantic Ridge Aviation Ltd', 'Atlantic Ridge', 'ARG-135-UK-044', 'KORIA is the broker. Atlantic Ridge Aviation Ltd has operational control.', 'Farnborough Airport'),
  ('99999999-9999-9999-9999-99999999000b', '77777777-7777-7777-7777-77777777000b', '88888888-8888-8888-8888-88888888000b', 'completed', 9600, 960, 0, 10560, 'USD', 'Lone Star Jet LLC', 'Lone Star Jet', 'LSJ-135-001', 'KORIA is the broker. Lone Star Jet LLC has operational control.', 'Signature Austin')
on conflict (id) do nothing;

insert into public.payments (id, booking_id, amount, currency, provider, provider_ref, status) values
  ('14141414-1414-1414-1414-141414140006', '99999999-9999-9999-9999-999999990006', 24200, 'USD', 'manual', 'pay_demo_nice', 'paid'),
  ('14141414-1414-1414-1414-14141414000b', '99999999-9999-9999-9999-99999999000b', 10560, 'USD', 'manual', 'pay_demo_cabo', 'paid')
on conflict (id) do nothing;

insert into public.payouts (id, operator_id, booking_id, amount, currency, status) values
  ('15151515-1515-1515-1515-151515150006', '44444444-4444-4444-4444-444444440007', '99999999-9999-9999-9999-999999990006', 22000, 'USD', 'paid'),
  ('15151515-1515-1515-1515-15151515000b', '44444444-4444-4444-4444-444444440001', '99999999-9999-9999-9999-99999999000b', 9600, 'USD', 'paid')
on conflict (id) do nothing;

-- ---------------------------------------------------------------------------
-- Passengers, preferences, passport, inbox
-- ---------------------------------------------------------------------------
insert into public.passenger_profiles (id, customer_id, full_name, date_of_birth, weight_lb) values
  ('dddddddd-dddd-dddd-dddd-dddddddddd01', '66666666-6666-6666-6666-666666660001', 'Alex Rivera', '1988-04-12', 175),
  ('dddddddd-dddd-dddd-dddd-dddddddddd02', '66666666-6666-6666-6666-666666660001', 'Sam Rivera', '1991-09-03', 140),
  ('dddddddd-dddd-dddd-dddd-dddddddddd03', '66666666-6666-6666-6666-666666660002', 'Sam Chen', '1985-01-22', 168),
  ('dddddddd-dddd-dddd-dddd-dddddddddd04', '66666666-6666-6666-6666-666666660002', 'Mei Chen', '1987-11-30', 132)
on conflict (id) do nothing;

insert into public.preferences (
  id, customer_id, home_airport_id, typical_passengers, pets, wifi_preferred, ski_golf, aircraft_preferences
) values
  ('dededede-dede-dede-dede-dededededede', '66666666-6666-6666-6666-666666660001', '11111111-1111-1111-1111-111111110001', 4, false, true, false, 'Light, Midsize'),
  ('dfdfdfdf-dfdf-dfdf-dfdf-dfdfdfdfdfdf', '66666666-6666-6666-6666-666666660002', '11111111-1111-1111-1111-111111110010', 2, false, true, true, 'Super-midsize')
on conflict (id) do nothing;

insert into public.passport_stamps (id, customer_id, title, detail, is_earned) values
  ('eeeeeeee-eeee-eeee-eeee-eeeeeeeeee01', '66666666-6666-6666-6666-666666660001', 'First Flight', 'The beginning of a private travel identity.', true),
  ('eeeeeeee-eeee-eeee-eeee-eeeeeeeeee02', '66666666-6666-6666-6666-666666660001', '10 Cities', 'A collection, not a coincidence.', false),
  ('eeeeeeee-eeee-eeee-eeee-eeeeeeeeee03', '66666666-6666-6666-6666-666666660001', 'Coast to Coast', 'One country, two oceans, no terminals.', true),
  ('eeeeeeee-eeee-eeee-eeee-eeeeeeeeee04', '66666666-6666-6666-6666-666666660001', 'Transatlantic', 'The ocean becomes a corridor.', false),
  ('eeeeeeee-eeee-eeee-eeee-eeeeeeeeee05', '66666666-6666-6666-6666-666666660001', 'Island Hopper', 'Water, then more water.', true),
  ('eeeeeeee-eeee-eeee-eeee-eeeeeeeeee06', '66666666-6666-6666-6666-666666660002', 'First Flight', 'The beginning of a private travel identity.', true),
  ('eeeeeeee-eeee-eeee-eeee-eeeeeeeeee07', '66666666-6666-6666-6666-666666660002', '10 Cities', 'A collection, not a coincidence.', false),
  ('eeeeeeee-eeee-eeee-eeee-eeeeeeeeee08', '66666666-6666-6666-6666-666666660002', 'Transatlantic', 'The ocean becomes a corridor.', false)
on conflict (id) do nothing;

insert into public.notifications (id, profile_id, title, body, read_at) values
  ('ffffffff-ffff-ffff-ffff-ffffffffff01', '66666666-6666-6666-6666-666666660001', 'Quote ready', 'Atelier Jet quoted Teterboro to Palm Beach.', null),
  ('ffffffff-ffff-ffff-ffff-ffffffffff02', '66666666-6666-6666-6666-666666660001', 'Payment due', 'Van Nuys to Aspen is waiting on payment.', null),
  ('ffffffff-ffff-ffff-ffff-ffffffffff03', '66666666-6666-6666-6666-666666660001', 'Trip confirmed', 'Miami to Nassau is confirmed on N450AT.', now() - interval '1 day'),
  ('ffffffff-ffff-ffff-ffff-ffffffffff04', '66666666-6666-6666-6666-666666660002', 'Quote declined', 'You declined the Miami to Dubai quote.', now() - interval '2 days'),
  ('ffffffff-ffff-ffff-ffff-ffffffffff05', '66666666-6666-6666-6666-666666660004', 'New request', 'Alex Rivera requested Austin to Cabo.', null)
on conflict (id) do nothing;

insert into public.searches (id, customer_id, query, result_count) values
  ('12121212-1212-1212-1212-121212120001', '66666666-6666-6666-6666-666666660001', '{"origin":"AUS","destination":"SJD","passengers":4}'::jsonb, 6),
  ('12121212-1212-1212-1212-121212120002', '66666666-6666-6666-6666-666666660001', '{"origin":"TEB","destination":"PBI","passengers":6}'::jsonb, 4),
  ('12121212-1212-1212-1212-121212120003', '66666666-6666-6666-6666-666666660002', '{"origin":"HPN","destination":"IBZ","passengers":2}'::jsonb, 2)
on conflict (id) do nothing;

insert into public.route_watches (id, customer_id, origin_id, destination_id) values
  ('16161616-1616-1616-1616-161616160001', '66666666-6666-6666-6666-666666660001', '11111111-1111-1111-1111-111111110001', '11111111-1111-1111-1111-111111110002'),
  ('16161616-1616-1616-1616-161616160002', '66666666-6666-6666-6666-666666660001', '11111111-1111-1111-1111-111111110004', '11111111-1111-1111-1111-111111110007'),
  ('16161616-1616-1616-1616-161616160003', '66666666-6666-6666-6666-666666660002', '11111111-1111-1111-1111-111111110010', '11111111-1111-1111-1111-11111111000b')
on conflict (id) do nothing;

-- If an admin already signed up, give that account a few trips too.
insert into public.trip_requests (
  id, customer_id, origin_id, destination_id, depart_at, return_at,
  passengers, prefs, flexible_days, nearby_airports, aircraft_id, status, notes, fbo
)
select
  v.id, p.id, v.origin_id, v.destination_id, v.depart_at, v.return_at,
  v.passengers, v.prefs, 0, false, v.aircraft_id, v.status, v.notes, v.fbo
from public.profiles p
cross join (
  values
    (
      '77777777-7777-7777-7777-777777770101'::uuid,
      '11111111-1111-1111-1111-111111110001'::uuid,
      '11111111-1111-1111-1111-111111110002'::uuid,
      now() + interval '11 days',
      now() + interval '14 days',
      4,
      '{"wifi": true}'::jsonb,
      null::uuid,
      'requested'::public.trip_status,
      'Sample request: Austin to Cabo.',
      'Signature Austin'
    ),
    (
      '77777777-7777-7777-7777-777777770102'::uuid,
      '11111111-1111-1111-1111-111111110004'::uuid,
      '11111111-1111-1111-1111-111111110006'::uuid,
      now() + interval '16 days',
      null,
      6,
      '{"wifi": true}'::jsonb,
      '55555555-5555-5555-5555-555555550003'::uuid,
      'quote_received'::public.trip_status,
      'Sample quote: Teterboro to Miami on the Citation X.',
      'Meridian Teterboro'
    ),
    (
      '77777777-7777-7777-7777-777777770103'::uuid,
      '11111111-1111-1111-1111-111111110005'::uuid,
      '11111111-1111-1111-1111-111111110008'::uuid,
      now() + interval '5 days',
      null,
      5,
      '{}'::jsonb,
      '55555555-5555-5555-5555-555555550002'::uuid,
      'upcoming'::public.trip_status,
      'Sample upcoming trip: Van Nuys to Las Vegas.',
      'Clay Lacy'
    ),
    (
      '77777777-7777-7777-7777-777777770104'::uuid,
      '11111111-1111-1111-1111-111111110006'::uuid,
      '11111111-1111-1111-1111-11111111000d'::uuid,
      now() - interval '12 days',
      now() - interval '9 days',
      4,
      '{}'::jsonb,
      '55555555-5555-5555-5555-555555550004'::uuid,
      'completed'::public.trip_status,
      'Sample completed trip: Miami to Nassau.',
      'Signature Miami'
    )
) as v(id, origin_id, destination_id, depart_at, return_at, passengers, prefs, aircraft_id, status, notes, fbo)
where p.role = 'admin'
  and p.id <> '66666666-6666-6666-6666-666666660001'
order by p.created_at
limit 4
on conflict (id) do nothing;

insert into public.quotes (
  id, trip_request_id, operator_id, aircraft_id,
  operator_amount, platform_fee_amount, taxes_amount, customer_total,
  currency, valid_until, notes, status, carrier_disclosure_snapshot, pricing_mode
)
select
  v.id, v.trip_id, v.operator_id, v.aircraft_id,
  v.operator_amount, v.platform_fee_amount, 0, v.customer_total,
  'USD', v.valid_until, v.notes, v.status, v.disclosure, v.pricing_mode
from (
  values
    (
      '88888888-8888-8888-8888-888888880102'::uuid,
      '77777777-7777-7777-7777-777777770102'::uuid,
      '44444444-4444-4444-4444-444444440003'::uuid,
      '55555555-5555-5555-5555-555555550003'::uuid,
      26800::numeric, 2680::numeric, 29480::numeric,
      now() + interval '4 days',
      'Sample quote for the signed-in admin account.',
      'pending'::public.quote_status,
      '{"legal_name":"Atelier Jet Inc.","dba":"Atelier Jet","certificate_number":"ATJ-135-2201","certificate_type":"Part 135"}'::jsonb,
      'live'::public.pricing_mode
    ),
    (
      '88888888-8888-8888-8888-888888880103'::uuid,
      '77777777-7777-7777-7777-777777770103'::uuid,
      '44444444-4444-4444-4444-444444440004'::uuid,
      '55555555-5555-5555-5555-555555550002'::uuid,
      11200::numeric, 1120::numeric, 12320::numeric,
      now() + interval '2 days',
      'Sample accepted quote, Van Nuys to Las Vegas.',
      'accepted'::public.quote_status,
      '{"legal_name":"Caldera Air LLC","dba":"Caldera","certificate_number":"CDA-135-0884","certificate_type":"Part 135"}'::jsonb,
      'estimated'::public.pricing_mode
    ),
    (
      '88888888-8888-8888-8888-888888880104'::uuid,
      '77777777-7777-7777-7777-777777770104'::uuid,
      '44444444-4444-4444-4444-444444440005'::uuid,
      '55555555-5555-5555-5555-555555550004'::uuid,
      15400::numeric, 1232::numeric, 16632::numeric,
      now() - interval '20 days',
      'Sample completed Nassau sector. Solstice fee is 8%.',
      'accepted'::public.quote_status,
      '{"legal_name":"Solstice Aviation Inc.","dba":"Solstice","certificate_number":"SOL-135-3310","certificate_type":"Part 135"}'::jsonb,
      'live'::public.pricing_mode
    )
) as v(
  id, trip_id, operator_id, aircraft_id,
  operator_amount, platform_fee_amount, customer_total,
  valid_until, notes, status, disclosure, pricing_mode
)
where exists (
  select 1 from public.trip_requests t where t.id = v.trip_id
)
on conflict (id) do nothing;

insert into public.bookings (
  id, trip_request_id, quote_id, status,
  operator_amount, platform_fee_amount, taxes_amount, customer_total, currency,
  operating_carrier_legal_name, operating_carrier_dba, certificate_number,
  broker_role_disclosure, fbo
)
select
  v.id, v.trip_id, v.quote_id, v.status,
  v.operator_amount, v.platform_fee_amount, 0, v.customer_total, 'USD',
  v.legal_name, v.dba, v.certificate_number,
  'KORIA is the broker. The operating carrier has operational control.',
  v.fbo
from (
  values
    (
      '99999999-9999-9999-9999-999999990103'::uuid,
      '77777777-7777-7777-7777-777777770103'::uuid,
      '88888888-8888-8888-8888-888888880103'::uuid,
      'confirmed'::public.booking_status,
      11200::numeric, 1120::numeric, 12320::numeric,
      'Caldera Air LLC', 'Caldera', 'CDA-135-0884', 'Clay Lacy'
    ),
    (
      '99999999-9999-9999-9999-999999990104'::uuid,
      '77777777-7777-7777-7777-777777770104'::uuid,
      '88888888-8888-8888-8888-888888880104'::uuid,
      'completed'::public.booking_status,
      15400::numeric, 1232::numeric, 16632::numeric,
      'Solstice Aviation Inc.', 'Solstice', 'SOL-135-3310', 'Signature Miami'
    )
) as v(
  id, trip_id, quote_id, status,
  operator_amount, platform_fee_amount, customer_total,
  legal_name, dba, certificate_number, fbo
)
where exists (
  select 1 from public.trip_requests t where t.id = v.trip_id
)
on conflict (id) do nothing;

-- Fan-out rows so the operator inbox includes demo trips after a reset.
-- Migrations run before this seed, so the backfill migration does not see these rows.
insert into public.trip_request_operators (trip_id, operator_id, status)
select q.trip_request_id,
  q.operator_id,
  case
    when t.status = 'declined' then 'declined'::public.trip_request_operator_status
    else 'quoted'::public.trip_request_operator_status
  end
from public.quotes q
join public.trip_requests t on t.id = q.trip_request_id
on conflict (trip_id, operator_id) do nothing;

insert into public.trip_request_operators (trip_id, operator_id, status)
select t.id,
  a.operator_id,
  case
    when t.status = 'declined' then 'declined'::public.trip_request_operator_status
    else 'pending'::public.trip_request_operator_status
  end
from public.trip_requests t
join public.aircraft a on a.id = t.aircraft_id
on conflict (trip_id, operator_id) do nothing;

-- Route-only demo requests (no aircraft). Two operators each, so one decline
-- does not close the trip.
insert into public.trip_request_operators (trip_id, operator_id, status)
select v.trip_id, v.operator_id, 'pending'
from (
  values
    ('77777777-7777-7777-7777-777777770001'::uuid, '44444444-4444-4444-4444-444444440002'::uuid),
    ('77777777-7777-7777-7777-777777770001'::uuid, '44444444-4444-4444-4444-444444440001'::uuid),
    ('77777777-7777-7777-7777-777777770009'::uuid, '44444444-4444-4444-4444-444444440006'::uuid),
    ('77777777-7777-7777-7777-777777770009'::uuid, '44444444-4444-4444-4444-444444440007'::uuid),
    ('77777777-7777-7777-7777-777777770101'::uuid, '44444444-4444-4444-4444-444444440002'::uuid),
    ('77777777-7777-7777-7777-777777770101'::uuid, '44444444-4444-4444-4444-444444440001'::uuid)
) as v(trip_id, operator_id)
where exists (select 1 from public.trip_requests t where t.id = v.trip_id)
on conflict (trip_id, operator_id) do nothing;
