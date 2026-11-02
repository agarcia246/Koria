-- KOR-74: run_rollover_trips_job (0008 + 0020) and payouts_one_per_booking (0036).
-- Threshold is depart_at <= now() + 72 hours (001 inclusive).
-- Payout amount is operator_amount - payout_adjustment (positive adjustment
-- reduces the payout; negative adjustment increases it).
-- Arrival for a round trip is return_at. Arrival for a one-way is
-- depart_at + estimated_block_minutes.

begin;
select plan(17);

select lives_ok(
  $$
  do $setup$
  begin
    insert into auth.users (
      instance_id, id, aud, role, email, encrypted_password,
      email_confirmed_at, raw_app_meta_data, raw_user_meta_data,
      created_at, updated_at,
      confirmation_token, email_change, email_change_token_new, recovery_token
    ) values (
      '00000000-0000-0000-0000-000000000000',
      'a7430000-0000-4000-8000-000000000001',
      'authenticated',
      'authenticated',
      'kor74-rollover@koria.test',
      extensions.crypt('koria-test', extensions.gen_salt('bf')),
      now(),
      '{"provider":"email","providers":["email"]}'::jsonb,
      '{"display_name":"KOR-74 Rollover"}'::jsonb,
      now(),
      now(),
      '', '', '', ''
    );

    insert into public.operators (id, name, code, legal_name, certificate_number)
    values (
      'a7430000-0000-4000-8000-000000000010',
      'KOR-74 Rollover Air',
      'K74ROL',
      'KOR-74 Rollover Air LLC',
      'K74ROL-135'
    );

    insert into public.aircraft (id, operator_id, model_id, tail_number, seating)
    values (
      'a7430000-0000-4000-8000-000000000020',
      'a7430000-0000-4000-8000-000000000010',
      '22222222-2222-2222-2222-222222220001',
      'N74ROL',
      6
    );

    insert into public.trip_requests (
      id, customer_id, origin_id, destination_id, depart_at, return_at, passengers, status, notes
    ) values
      (
        'a7430000-0000-4000-8000-000000000101',
        'a7430000-0000-4000-8000-000000000001',
        '11111111-1111-1111-1111-111111110001',
        '11111111-1111-1111-1111-111111110004',
        now() + interval '71 hours',
        null,
        2,
        'confirmed',
        'kor74 rollover 71h'
      ),
      (
        'a7430000-0000-4000-8000-000000000102',
        'a7430000-0000-4000-8000-000000000001',
        '11111111-1111-1111-1111-111111110001',
        '11111111-1111-1111-1111-111111110004',
        now() + interval '73 hours',
        null,
        2,
        'confirmed',
        'kor74 rollover 73h'
      ),
      (
        'a7430000-0000-4000-8000-000000000103',
        'a7430000-0000-4000-8000-000000000001',
        '11111111-1111-1111-1111-111111110001',
        '11111111-1111-1111-1111-111111110004',
        now() - interval '2 days',
        now() - interval '1 hour',
        2,
        'upcoming',
        'kor74 rollover positive adjustment'
      ),
      (
        'a7430000-0000-4000-8000-000000000104',
        'a7430000-0000-4000-8000-000000000001',
        '11111111-1111-1111-1111-111111110001',
        '11111111-1111-1111-1111-111111110004',
        now() - interval '3 days',
        now() - interval '2 hours',
        2,
        'upcoming',
        'kor74 rollover negative adjustment'
      ),
      (
        'a7430000-0000-4000-8000-000000000105',
        'a7430000-0000-4000-8000-000000000001',
        '11111111-1111-1111-1111-111111110001',
        '11111111-1111-1111-1111-111111110004',
        now() - interval '2 hours',
        null,
        2,
        'upcoming',
        'kor74 rollover one-way landed'
      ),
      (
        'a7430000-0000-4000-8000-000000000106',
        'a7430000-0000-4000-8000-000000000001',
        '11111111-1111-1111-1111-111111110001',
        '11111111-1111-1111-1111-111111110004',
        now() - interval '30 minutes',
        null,
        2,
        'upcoming',
        'kor74 rollover one-way airborne'
      );

    insert into public.quotes (
      id, trip_request_id, operator_id, aircraft_id,
      operator_amount, platform_fee_amount, taxes_amount, customer_total,
      status, pricing_mode
    ) values
      ('a7430000-0000-4000-8000-000000000111', 'a7430000-0000-4000-8000-000000000101', 'a7430000-0000-4000-8000-000000000010', 'a7430000-0000-4000-8000-000000000020', 10000, 0, 0, 10000, 'accepted', 'estimated'),
      ('a7430000-0000-4000-8000-000000000112', 'a7430000-0000-4000-8000-000000000102', 'a7430000-0000-4000-8000-000000000010', 'a7430000-0000-4000-8000-000000000020', 10000, 0, 0, 10000, 'accepted', 'estimated'),
      ('a7430000-0000-4000-8000-000000000113', 'a7430000-0000-4000-8000-000000000103', 'a7430000-0000-4000-8000-000000000010', 'a7430000-0000-4000-8000-000000000020', 10000, 0, 0, 10000, 'accepted', 'estimated'),
      ('a7430000-0000-4000-8000-000000000114', 'a7430000-0000-4000-8000-000000000104', 'a7430000-0000-4000-8000-000000000010', 'a7430000-0000-4000-8000-000000000020', 10000, 0, 0, 10000, 'accepted', 'estimated'),
      ('a7430000-0000-4000-8000-000000000115', 'a7430000-0000-4000-8000-000000000105', 'a7430000-0000-4000-8000-000000000010', 'a7430000-0000-4000-8000-000000000020', 10000, 0, 0, 10000, 'accepted', 'estimated'),
      ('a7430000-0000-4000-8000-000000000116', 'a7430000-0000-4000-8000-000000000106', 'a7430000-0000-4000-8000-000000000010', 'a7430000-0000-4000-8000-000000000020', 10000, 0, 0, 10000, 'accepted', 'estimated');

    insert into public.bookings (
      id, trip_request_id, quote_id, status,
      operator_amount, platform_fee_amount, taxes_amount, customer_total,
      currency, payout_adjustment, estimated_block_minutes
    ) values
      ('a7430000-0000-4000-8000-000000000121', 'a7430000-0000-4000-8000-000000000101', 'a7430000-0000-4000-8000-000000000111', 'confirmed', 10000, 0, 0, 10000, 'USD', 0, 90),
      ('a7430000-0000-4000-8000-000000000122', 'a7430000-0000-4000-8000-000000000102', 'a7430000-0000-4000-8000-000000000112', 'confirmed', 10000, 0, 0, 10000, 'USD', 0, 90),
      ('a7430000-0000-4000-8000-000000000123', 'a7430000-0000-4000-8000-000000000103', 'a7430000-0000-4000-8000-000000000113', 'confirmed', 10000, 0, 0, 10000, 'EUR', 250, 120),
      ('a7430000-0000-4000-8000-000000000124', 'a7430000-0000-4000-8000-000000000104', 'a7430000-0000-4000-8000-000000000114', 'confirmed', 10000, 0, 0, 10000, 'USD', -400, 120),
      ('a7430000-0000-4000-8000-000000000125', 'a7430000-0000-4000-8000-000000000105', 'a7430000-0000-4000-8000-000000000115', 'confirmed', 10000, 0, 0, 10000, 'USD', 0, 30),
      ('a7430000-0000-4000-8000-000000000126', 'a7430000-0000-4000-8000-000000000106', 'a7430000-0000-4000-8000-000000000116', 'confirmed', 10000, 0, 0, 10000, 'USD', 0, 120);
  end
  $setup$;
  $$,
  'rollover fixtures'
);

select lives_ok($$select public.run_rollover_trips_job()$$, 'first rollover run');
select lives_ok($$select public.run_rollover_trips_job()$$, 'second rollover run');

select is(
  (select status::text from public.trip_requests where id = 'a7430000-0000-4000-8000-000000000101'),
  'upcoming',
  'confirmed trip 71 hours out becomes upcoming'
);

select is(
  (select status::text from public.bookings where id = 'a7430000-0000-4000-8000-000000000121'),
  'confirmed',
  '71h trip does not complete the booking'
);

select is(
  (select status::text from public.trip_requests where id = 'a7430000-0000-4000-8000-000000000102'),
  'confirmed',
  'confirmed trip 73 hours out stays confirmed'
);

select is(
  (select status::text from public.trip_requests where id = 'a7430000-0000-4000-8000-000000000103'),
  'completed',
  'upcoming round trip with return_at in the past completes'
);

select is(
  (select status::text from public.bookings where id = 'a7430000-0000-4000-8000-000000000123'),
  'completed',
  'booking on a completed round trip is completed'
);

select results_eq(
  $$select amount, currency, status
    from public.payouts
    where booking_id = 'a7430000-0000-4000-8000-000000000123'$$,
  $$values (9750::numeric, 'EUR'::text, 'unpaid'::text)$$,
  'positive payout_adjustment is subtracted; currency is copied; status is unpaid'
);

select results_eq(
  $$select amount, currency, status
    from public.payouts
    where booking_id = 'a7430000-0000-4000-8000-000000000124'$$,
  $$values (10400::numeric, 'USD'::text, 'unpaid'::text)$$,
  'negative payout_adjustment increases the payout'
);

select is(
  (select status::text from public.trip_requests where id = 'a7430000-0000-4000-8000-000000000105'),
  'completed',
  'one-way upcoming trip completes once depart_at + block minutes is past'
);

select is(
  (select status::text from public.bookings where id = 'a7430000-0000-4000-8000-000000000125'),
  'completed',
  'one-way booking is completed with the trip'
);

select results_eq(
  $$select amount, currency, status
    from public.payouts
    where booking_id = 'a7430000-0000-4000-8000-000000000125'$$,
  $$values (10000::numeric, 'USD'::text, 'unpaid'::text)$$,
  'zero payout_adjustment pays operator_amount'
);

select is(
  (select status::text from public.trip_requests where id = 'a7430000-0000-4000-8000-000000000106'),
  'upcoming',
  'one-way trip still inside block minutes stays upcoming'
);

select is(
  (
    select count(*)::int
    from public.payouts
    where booking_id in (
      'a7430000-0000-4000-8000-000000000121',
      'a7430000-0000-4000-8000-000000000122',
      'a7430000-0000-4000-8000-000000000126'
    )
  ),
  0,
  'trips that are not completed do not get a payout'
);

select is(
  (
    select count(*)::int
    from public.payouts
    where booking_id in (
      'a7430000-0000-4000-8000-000000000123',
      'a7430000-0000-4000-8000-000000000124',
      'a7430000-0000-4000-8000-000000000125'
    )
  ),
  3,
  'running the job twice still leaves one payout per completed booking'
);

select is(
  (
    select count(*)::int
    from public.job_runs
    where job_name = 'koria_rollover_trips'
      and ran_at = now()
      and note like 'upcoming %, completed % trips, % bookings, % payouts'
  ),
  2,
  'each rollover run writes a job_runs row'
);

select * from finish();
rollback;
