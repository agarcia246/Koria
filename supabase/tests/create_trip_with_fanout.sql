-- KOR-74: create_trip_with_fanout (0005).
-- authenticated is revoked. service_role inserts the trip and every
-- trip_request_operators row in one transaction. A bad operator id
-- (FK) rolls the trip back with the fan-out rows.

begin;
select plan(8);

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
      'a7420000-0000-4000-8000-000000000001',
      'authenticated',
      'authenticated',
      'kor74-fanout@koria.test',
      extensions.crypt('koria-test', extensions.gen_salt('bf')),
      now(),
      '{"provider":"email","providers":["email"]}'::jsonb,
      '{"display_name":"KOR-74 Fanout"}'::jsonb,
      now(),
      now(),
      '', '', '', ''
    );

    insert into public.operators (id, name, code, legal_name, certificate_number)
    values
      (
        'a7420000-0000-4000-8000-000000000010',
        'KOR-74 Fanout One',
        'K74FN1',
        'KOR-74 Fanout One LLC',
        'K74FN1-135'
      ),
      (
        'a7420000-0000-4000-8000-000000000011',
        'KOR-74 Fanout Two',
        'K74FN2',
        'KOR-74 Fanout Two LLC',
        'K74FN2-135'
      );
  end
  $setup$;
  $$,
  'fan-out fixtures'
);

select throws_ok(
  $$
  do $denied$
  begin
    set local role authenticated;
    perform public.create_trip_with_fanout(
      'a7420000-0000-4000-8000-000000000001'::uuid,
      '11111111-1111-1111-1111-111111110001'::uuid,
      '11111111-1111-1111-1111-111111110004'::uuid,
      timestamptz '2030-07-01 15:00:00+00',
      null,
      2,
      '{}'::jsonb,
      null,
      null,
      'kor74-fanout-denied',
      array[
        'a7420000-0000-4000-8000-000000000010'::uuid,
        'a7420000-0000-4000-8000-000000000011'::uuid
      ]
    );
  end
  $denied$;
  $$,
  '42501',
  'permission denied for function create_trip_with_fanout',
  'authenticated cannot call create_trip_with_fanout'
);

select lives_ok(
  $$
  do $ok$
  begin
    set local role service_role;
    perform public.create_trip_with_fanout(
      'a7420000-0000-4000-8000-000000000001'::uuid,
      '11111111-1111-1111-1111-111111110001'::uuid,
      '11111111-1111-1111-1111-111111110004'::uuid,
      timestamptz '2030-07-01 15:00:00+00',
      null,
      3,
      '{}'::jsonb,
      null,
      null,
      'kor74-fanout-ok',
      array[
        'a7420000-0000-4000-8000-000000000010'::uuid,
        'a7420000-0000-4000-8000-000000000011'::uuid
      ]
    );
  end
  $ok$;
  $$,
  'service role creates the trip and fan-out rows'
);

select is(
  (select count(*)::int from public.trip_requests where notes = 'kor74-fanout-ok'),
  1,
  'one trip row'
);

select is(
  (select status::text from public.trip_requests where notes = 'kor74-fanout-ok'),
  'requested',
  'fan-out trip starts as requested'
);

select results_eq(
  $$select tro.operator_id::text, tro.status::text
    from public.trip_request_operators tro
    join public.trip_requests t on t.id = tro.trip_id
    where t.notes = 'kor74-fanout-ok'
    order by 1$$,
  $$values
    ('a7420000-0000-4000-8000-000000000010'::text, 'pending'::text),
    ('a7420000-0000-4000-8000-000000000011'::text, 'pending'::text)
  $$,
  'one pending fan-out row per operator id'
);

select throws_ok(
  $$
  do $fail$
  begin
    set local role service_role;
    perform public.create_trip_with_fanout(
      'a7420000-0000-4000-8000-000000000001'::uuid,
      '11111111-1111-1111-1111-111111110001'::uuid,
      '11111111-1111-1111-1111-111111110004'::uuid,
      timestamptz '2030-07-02 15:00:00+00',
      null,
      2,
      '{}'::jsonb,
      null,
      null,
      'kor74-fanout-fail',
      array[
        'a7420000-0000-4000-8000-000000000010'::uuid,
        'a7420000-0000-4000-8000-0000000000ff'::uuid
      ]
    );
  end
  $fail$;
  $$,
  '23503',
  'insert or update on table "trip_request_operators" violates foreign key constraint "trip_request_operators_operator_id_fkey"',
  'a missing operator id aborts the fan-out'
);

select is(
  (select count(*)::int from public.trip_requests where notes = 'kor74-fanout-fail'),
  0,
  'failed fan-out leaves no trip row'
);

select * from finish();
rollback;
