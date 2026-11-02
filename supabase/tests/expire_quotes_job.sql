-- KOR-74: run_expire_quotes_job (0007).
-- Called as the migration role. Execute is revoked from anon and authenticated;
-- pg_cron runs the function as the role that scheduled it.
-- Rows are inserted here so the result does not depend on seed.demo.sql.

begin;
select plan(10);

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
      'a7410000-0000-4000-8000-000000000001',
      'authenticated',
      'authenticated',
      'kor74-expire@koria.test',
      extensions.crypt('koria-test', extensions.gen_salt('bf')),
      now(),
      '{"provider":"email","providers":["email"]}'::jsonb,
      '{"display_name":"KOR-74 Expire"}'::jsonb,
      now(),
      now(),
      '', '', '', ''
    );

    insert into public.operators (id, name, code, legal_name, certificate_number)
    values (
      'a7410000-0000-4000-8000-000000000010',
      'KOR-74 Expire Air',
      'K74EXP',
      'KOR-74 Expire Air LLC',
      'K74EXP-135'
    );

    insert into public.aircraft (id, operator_id, model_id, tail_number, seating)
    values (
      'a7410000-0000-4000-8000-000000000020',
      'a7410000-0000-4000-8000-000000000010',
      '22222222-2222-2222-2222-222222220001',
      'N74EXP',
      6
    );

    insert into public.trip_requests (
      id, customer_id, origin_id, destination_id, depart_at, passengers, status, notes
    ) values
      (
        'a7410000-0000-4000-8000-000000000101',
        'a7410000-0000-4000-8000-000000000001',
        '11111111-1111-1111-1111-111111110001',
        '11111111-1111-1111-1111-111111110004',
        now() + interval '10 days',
        2,
        'quote_received',
        'kor74 expire only quote'
      ),
      (
        'a7410000-0000-4000-8000-000000000102',
        'a7410000-0000-4000-8000-000000000001',
        '11111111-1111-1111-1111-111111110001',
        '11111111-1111-1111-1111-111111110004',
        now() + interval '11 days',
        2,
        'quote_received',
        'kor74 expire mixed quotes'
      ),
      (
        'a7410000-0000-4000-8000-000000000103',
        'a7410000-0000-4000-8000-000000000001',
        '11111111-1111-1111-1111-111111110001',
        '11111111-1111-1111-1111-111111110004',
        now() + interval '12 days',
        2,
        'quote_received',
        'kor74 expire accepted quote'
      );

    insert into public.quotes (
      id, trip_request_id, operator_id, aircraft_id,
      operator_amount, platform_fee_amount, taxes_amount, customer_total,
      valid_until, status, pricing_mode
    ) values
      (
        'a7410000-0000-4000-8000-000000000111',
        'a7410000-0000-4000-8000-000000000101',
        'a7410000-0000-4000-8000-000000000010',
        'a7410000-0000-4000-8000-000000000020',
        10000, 0, 0, 10000,
        now() - interval '1 hour',
        'pending',
        'estimated'
      ),
      (
        'a7410000-0000-4000-8000-000000000112',
        'a7410000-0000-4000-8000-000000000102',
        'a7410000-0000-4000-8000-000000000010',
        'a7410000-0000-4000-8000-000000000020',
        10000, 0, 0, 10000,
        now() - interval '1 day',
        'pending',
        'estimated'
      ),
      (
        'a7410000-0000-4000-8000-000000000113',
        'a7410000-0000-4000-8000-000000000102',
        'a7410000-0000-4000-8000-000000000010',
        'a7410000-0000-4000-8000-000000000020',
        11000, 0, 0, 11000,
        now() + interval '2 days',
        'pending',
        'estimated'
      ),
      (
        'a7410000-0000-4000-8000-000000000114',
        'a7410000-0000-4000-8000-000000000103',
        'a7410000-0000-4000-8000-000000000010',
        'a7410000-0000-4000-8000-000000000020',
        12000, 0, 0, 12000,
        now() - interval '1 day',
        'accepted',
        'estimated'
      );
  end
  $setup$;
  $$,
  'expire-quote fixtures'
);

select lives_ok(
  $$select public.run_expire_quotes_job()$$,
  'run_expire_quotes_job'
);

select is(
  (select status::text from public.quotes where id = 'a7410000-0000-4000-8000-000000000111'),
  'expired',
  'pending quote past valid_until expires'
);

select is(
  (select status::text from public.trip_requests where id = 'a7410000-0000-4000-8000-000000000101'),
  'requested',
  'quote_received trip whose only quote expired returns to requested'
);

select is(
  (select status::text from public.quotes where id = 'a7410000-0000-4000-8000-000000000112'),
  'expired',
  'expired quote on a mixed trip still expires'
);

select is(
  (select status::text from public.quotes where id = 'a7410000-0000-4000-8000-000000000113'),
  'pending',
  'pending quote still inside valid_until is untouched'
);

select is(
  (select status::text from public.trip_requests where id = 'a7410000-0000-4000-8000-000000000102'),
  'quote_received',
  'trip with one expired quote and one pending quote stays quote_received'
);

select is(
  (select status::text from public.quotes where id = 'a7410000-0000-4000-8000-000000000114'),
  'accepted',
  'accepted quote past valid_until is untouched'
);

select is(
  (select status::text from public.trip_requests where id = 'a7410000-0000-4000-8000-000000000103'),
  'quote_received',
  'an accepted quote still counts, so the trip stays quote_received'
);

select is(
  (
    select count(*)::int
    from public.job_runs
    where job_name = 'koria_expire_quotes'
      and ran_at = now()
      and note like 'expired % quotes, reverted % trips'
  ),
  1,
  'expire job writes a job_runs row'
);

select * from finish();
rollback;
