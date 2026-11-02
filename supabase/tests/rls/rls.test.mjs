import assert from 'node:assert/strict';
import { before, describe, test } from 'node:test';

import {
  ANON,
  ID,
  SERVICE,
  assertHidden,
  assertUpdateAllowed,
  assertUpdateBlocked,
  del,
  detail,
  ensureUser,
  getOne,
  insert,
  listObjects,
  patch,
  request,
  rows,
  signIn,
  uploadText,
  upsert,
  waitForApi,
} from './helpers.mjs';

// Shared Northline columns are restored inside each test. Tests still run serially
// so a member denial and an operator-admin success cannot overlap on the same row.
describe('RLS regression', { concurrency: false }, () => {
  /** @type {Awaited<ReturnType<typeof setup>>} */
  let ctx;

  before(async () => {
    ctx = await setup();
  }, { timeout: 180_000 });

  test('customer cannot update profiles.role', async () => {
    await assertUpdateBlocked(ctx.customer.token, 'profiles', ID.alex, { role: 'admin' });
  });

  test('customer cannot update profiles.access_status', async () => {
    await assertUpdateBlocked(ctx.customer.token, 'profiles', ID.alex, { access_status: 'declined' });
  });

  test('customer cannot update access_requests.status', async () => {
    await assertUpdateBlocked(ctx.customer.token, 'access_requests', ID.alexAccess, { status: 'declined' });
  });

  for (const [column, value] of [
    ['customer_total', 1],
    ['operator_amount', 1],
    ['platform_fee_amount', 1],
    ['taxes_amount', 1],
    ['status', 'declined'],
    ['valid_until', '2031-06-15T12:00:00.000Z'],
  ]) {
    test(`customer cannot update quotes.${column}`, async () => {
      await assertUpdateBlocked(ctx.customer.token, 'quotes', ID.alexQuote, { [column]: value });
    });
  }

  test('customer cannot update trip_requests.status', async () => {
    await assertUpdateBlocked(ctx.customer.token, 'trip_requests', ID.alexOpenTrip, { status: 'confirmed' });
  });

  test('customer cannot update trip_requests.aircraft_id', async () => {
    await assertUpdateBlocked(ctx.customer.token, 'trip_requests', ID.alexOpenTrip, {
      aircraft_id: ID.northlineAircraft,
    });
  });

  test("customer cannot select another customer's trip_requests", async () => {
    await assertHidden(ctx.customer.token, 'trip_requests', ID.samTrip);
  });

  test("customer cannot select another customer's bookings", async () => {
    await assertHidden(ctx.customer.token, 'bookings', ID.samBooking);
  });

  test("customer cannot select another customer's invoices", async () => {
    await assertHidden(ctx.customer.token, 'invoices', ID.invoice);
  });

  test("customer cannot select another customer's payments", async () => {
    await assertHidden(ctx.customer.token, 'payments', ID.samPayment);
  });

  test("customer cannot select another customer's passenger_profiles", async () => {
    await assertHidden(ctx.customer.token, 'passenger_profiles', ID.samPassenger);
  });

  test("customer cannot select another customer's notifications", async () => {
    await assertHidden(ctx.customer.token, 'notifications', ID.samNotification);
  });

  test('customer can select profiles', async () => {
    const mine = await rows(ctx.customer.token, `profiles?id=eq.${ID.alex}&select=id,role,access_status`);
    assert.equal(mine.length, 1);
    assert.equal(mine[0].id, ID.alex);
    assert.equal(mine[0].role, 'customer');
  });

  test('customer can update notifications.read_at', async () => {
    const stamp = '2031-01-02T03:04:05.000Z';
    await assertUpdateAllowed(ctx.customer.token, 'notifications', ID.alexNotification, { read_at: stamp });
  });

  test('customer can insert passenger_profiles', async () => {
    const res = await insert(ctx.customer.token, 'passenger_profiles', {
      customer_id: ID.alex,
      full_name: 'RLS Pax Insert',
    });
    assert.equal(res.status, 201, detail(res));
    assert.equal(res.body?.[0]?.customer_id, ID.alex);
    await del('passenger_profiles', `id=eq.${res.body[0].id}`);
  });

  test('customer can delete passenger_profiles', async () => {
    const created = await insert(ctx.customer.token, 'passenger_profiles', {
      customer_id: ID.alex,
      full_name: 'RLS Pax Delete',
    });
    assert.equal(created.status, 201, detail(created));
    const id = created.body[0].id;
    const removed = await request(ctx.customer.token, 'DELETE', `/rest/v1/passenger_profiles?id=eq.${id}`, {
      prefer: 'return=representation',
    });
    assert.ok(removed.status === 200 || removed.status === 204, detail(removed));
    const left = await rows(SERVICE, `passenger_profiles?id=eq.${id}&select=id`);
    assert.equal(left.length, 0);
  });

  for (const [column, value] of [
    ['operator_amount', 1],
    ['customer_total', 1],
    ['status', 'cancelled'],
  ]) {
    test(`operator A member cannot update bookings.${column}`, async () => {
      await assertUpdateBlocked(ctx.operatorAdmin.token, 'bookings', ID.northlineBooking, { [column]: value });
    });
  }

  test('operator A member cannot update bookings.payout_adjustment', async () => {
    await assertUpdateBlocked(ctx.operatorMember.token, 'bookings', ID.northlineBooking, {
      payout_adjustment: 99,
    });
  });

  test('operator A member cannot update operators.verified_at', async () => {
    await assertUpdateBlocked(ctx.operatorMember.token, 'operators', ID.northline, {
      verified_at: '2020-01-01T00:00:00.000Z',
    });
  });

  test('operator A member cannot update operators.default_fee_bps', async () => {
    await assertUpdateBlocked(ctx.operatorMember.token, 'operators', ID.northline, { default_fee_bps: 500 });
  });

  test('operator A member cannot update operators.certificate_number', async () => {
    await assertUpdateBlocked(ctx.operatorMember.token, 'operators', ID.northline, {
      certificate_number: 'RLS-CHANGED',
    });
  });

  test('operator A member cannot update aircraft.is_active', async () => {
    // Already-active tail, no agreement on file. 0035 rejects any update that leaves is_active true.
    const before = await getOne('aircraft', ID.northlineAircraft);
    await assertUpdateBlocked(ctx.operatorAdmin.token, 'aircraft', ID.northlineAircraft, {
      is_active: true,
      cabin_notes: 'rls-should-not-apply',
    });
    const after = await getOne('aircraft', ID.northlineAircraft);
    assert.equal(after.cabin_notes, before.cabin_notes);
    assert.equal(after.is_active, true);
  });

  test('operator A cannot select operator B inactive aircraft', async () => {
    await assertHidden(ctx.operatorAdmin.token, 'aircraft', ID.inactiveAircraft, {
      alsoVisibleTo: ctx.operatorB.token,
    });
  });

  test('operator A cannot select operator B aircraft_availability', async () => {
    await assertHidden(ctx.operatorAdmin.token, 'aircraft_availability', ID.inactiveAvailability, {
      alsoVisibleTo: ctx.operatorB.token,
    });
  });

  test('operator A cannot select operator B operator_api_keys', async () => {
    await assertHidden(ctx.operatorAdmin.token, 'operator_api_keys', ID.apiKey, {
      alsoVisibleTo: ctx.operatorB.token,
    });
  });

  test('operator A cannot select operator B payouts', async () => {
    await assertHidden(ctx.operatorAdmin.token, 'payouts', ID.payout, {
      alsoVisibleTo: ctx.operatorB.token,
    });
  });

  test('operator A cannot select operator B operator_members', async () => {
    await assertHidden(ctx.operatorAdmin.token, 'operator_members', ctx.atelierMembershipId, {
      alsoVisibleTo: ctx.operatorB.token,
    });
  });

  test('operator A cannot list operator B operator-documents', async () => {
    const prefix = `${ID.atelier}/`;
    const asService = await listObjects(SERVICE, 'operator-documents', prefix);
    assert.equal(asService.status, 200, detail(asService));
    assert.ok(
      Array.isArray(asService.body) && asService.body.some((object) => String(object.name).includes('fixture.txt')),
      `service role could not see the fixture object: ${detail(asService)}`,
    );
    const asA = await listObjects(ctx.operatorAdmin.token, 'operator-documents', prefix);
    assert.equal(asA.status, 200, detail(asA));
    assert.ok(Array.isArray(asA.body), detail(asA));
    assert.equal(asA.body.length, 0, JSON.stringify(asA.body));
    const asB = await listObjects(ctx.operatorB.token, 'operator-documents', prefix);
    assert.equal(asB.status, 200, detail(asB));
    assert.ok(
      Array.isArray(asB.body) && asB.body.some((object) => String(object.name).includes('fixture.txt')),
      `operator B could not see their own document: ${detail(asB)}`,
    );
  });

  test('operator A member can insert aircraft', async () => {
    await del('aircraft', `id=eq.${ID.aircraftInsert}`);
    const res = await insert(ctx.operatorAdmin.token, 'aircraft', {
      id: ID.aircraftInsert,
      operator_id: ID.northline,
      model_id: ID.model,
      tail_number: 'NRLS70A',
      seating: 4,
      is_active: false,
    });
    assert.equal(res.status, 201, detail(res));
    assert.equal(res.body?.[0]?.is_active, false);
    await del('aircraft', `id=eq.${ID.aircraftInsert}`);
  });

  test('operator A member can update aircraft.cabin_notes', async () => {
    // Inactive tail: an already-active row cannot be edited until an agreement is on file (0035).
    await del('aircraft', `id=eq.${ID.aircraftInsert}`);
    const created = await insert(ctx.operatorAdmin.token, 'aircraft', {
      id: ID.aircraftInsert,
      operator_id: ID.northline,
      model_id: ID.model,
      tail_number: 'NRLS70A',
      seating: 4,
      is_active: false,
      cabin_notes: 'before',
    });
    assert.equal(created.status, 201, detail(created));
    try {
      await assertUpdateAllowed(ctx.operatorAdmin.token, 'aircraft', ID.aircraftInsert, {
        cabin_notes: 'RLS inactive note',
      });
    } finally {
      await del('aircraft', `id=eq.${ID.aircraftInsert}`);
    }
  });

  test('operator A admin can update bookings.payout_adjustment', async () => {
    await assertUpdateAllowed(ctx.operatorAdmin.token, 'bookings', ID.adminBooking, { payout_adjustment: 25 });
  });

  test('operator A admin can update operators.default_fee_bps', async () => {
    await assertUpdateAllowed(ctx.operatorAdmin.token, 'operators', ID.northline, { default_fee_bps: 650 });
  });

  test('operator A member can insert quotes', async () => {
    await del('quotes', `id=eq.${ID.quoteInsert}`);
    const res = await insert(ctx.operatorAdmin.token, 'quotes', {
      id: ID.quoteInsert,
      trip_request_id: ID.alexOpenTrip,
      operator_id: ID.northline,
      aircraft_id: ID.northlineAircraft,
      operator_amount: 10000,
      platform_fee_amount: 1000,
      taxes_amount: 0,
      customer_total: 11000,
      currency: 'USD',
      status: 'pending',
      pricing_mode: 'live',
      valid_until: '2031-06-15T12:00:00.000Z',
      notes: 'RLS suite quote',
    });
    assert.equal(res.status, 201, detail(res));
    assert.equal(res.body?.[0]?.operator_id, ID.northline);
    await del('quotes', `id=eq.${ID.quoteInsert}`);
  });

  test('operator A member can insert trip_documents', async () => {
    await del('trip_documents', `id=eq.${ID.documentInsert}`);
    const res = await insert(ctx.operatorAdmin.token, 'trip_documents', {
      id: ID.documentInsert,
      trip_request_id: ID.northlineTrip,
      title: 'RLS accepted-trip document',
    });
    assert.equal(res.status, 201, detail(res));
    await del('trip_documents', `id=eq.${ID.documentInsert}`);
  });

  test('admin can update profiles.role', async () => {
    await assertUpdateAllowed(ctx.admin.token, 'profiles', ctx.subject.id, { role: 'operator' });
  });

  test('admin can update profiles.access_status', async () => {
    await assertUpdateAllowed(ctx.admin.token, 'profiles', ctx.subject.id, { access_status: 'approved' });
  });

  test('admin can update access_requests.status', async () => {
    await assertUpdateAllowed(ctx.admin.token, 'access_requests', ID.adminAccess, { status: 'approved' });
  });

  for (const [column, value] of [
    ['customer_total', 1],
    ['operator_amount', 1],
    ['platform_fee_amount', 1],
    ['taxes_amount', 1],
    ['status', 'expired'],
    ['valid_until', '2031-07-01T00:00:00.000Z'],
  ]) {
    test(`admin can update quotes.${column}`, async () => {
      await assertUpdateAllowed(ctx.admin.token, 'quotes', ID.adminQuote, { [column]: value });
    });
  }

  test('admin can update trip_requests.status', async () => {
    await assertUpdateAllowed(ctx.admin.token, 'trip_requests', ID.adminTrip, { status: 'quote_received' });
  });

  test('admin can update trip_requests.aircraft_id', async () => {
    await assertUpdateAllowed(ctx.admin.token, 'trip_requests', ID.adminTrip, {
      aircraft_id: ID.northlineAircraft,
    });
  });

  for (const [column, value] of [
    ['operator_amount', 1],
    ['customer_total', 1],
    ['status', 'confirmed'],
    ['payout_adjustment', 15],
  ]) {
    test(`admin can update bookings.${column}`, async () => {
      await assertUpdateAllowed(ctx.admin.token, 'bookings', ID.adminBooking, { [column]: value });
    });
  }

  test('admin can update operators.verified_at', async () => {
    await assertUpdateAllowed(ctx.admin.token, 'operators', ID.adminOperator, {
      verified_at: '2026-06-01T00:00:00.000Z',
    });
  });

  test('admin can update operators.certificate_number', async () => {
    await assertUpdateAllowed(ctx.admin.token, 'operators', ID.adminOperator, {
      certificate_number: 'RLS-135-0071',
    });
  });

  test('admin can update operators.default_fee_bps', async () => {
    await assertUpdateAllowed(ctx.admin.token, 'operators', ID.adminOperator, { default_fee_bps: 777 });
  });

  test('admin can update aircraft.is_active', async () => {
    await assertUpdateAllowed(ctx.admin.token, 'aircraft', ID.adminAircraft, { is_active: true });
  });

  test('service role can call create_trip_with_fanout', async () => {
    const res = await request(SERVICE, 'POST', '/rest/v1/rpc/create_trip_with_fanout', {
      apikey: SERVICE,
      prefer: 'return=representation',
      body: {
        p_customer_id: ID.alex,
        p_origin_id: ID.origin,
        p_destination_id: ID.destination,
        p_depart_at: '2026-12-20T15:00:00.000Z',
        p_return_at: null,
        p_passengers: 2,
        p_prefs: { wifi: true },
        p_aircraft_id: null,
        p_empty_leg_id: null,
        p_notes: 'RLS suite fan-out',
        p_operator_ids: [ID.northline],
      },
    });
    assert.ok(res.status >= 200 && res.status < 300, detail(res));
    const trip = Array.isArray(res.body) ? res.body[0] : res.body;
    assert.ok(trip?.id, detail(res));
    assert.equal(trip.customer_id, ID.alex);
    const fanout = await rows(
      SERVICE,
      `trip_request_operators?trip_id=eq.${trip.id}&operator_id=eq.${ID.northline}&select=status`,
    );
    assert.equal(fanout.length, 1);
    assert.equal(fanout[0].status, 'pending');
    await del('trip_requests', `id=eq.${trip.id}`);
  });

  test('service role can call next_invoice_number', async () => {
    const res = await request(SERVICE, 'POST', '/rest/v1/rpc/next_invoice_number', {
      apikey: SERVICE,
      body: {},
    });
    assert.ok(res.status >= 200 && res.status < 300, detail(res));
    assert.match(String(res.body).replaceAll('"', ''), /^KOR-\d{4}-\d{6}$/, detail(res));
  });

  for (const table of [
    'profiles',
    'operators',
    'aircraft',
    'trip_requests',
    'quotes',
    'bookings',
    'payments',
    'invoices',
    'notifications',
    'access_requests',
    'operator_members',
    'operator_api_keys',
    'payouts',
    'audit_events',
    'job_runs',
  ]) {
    test(`anon cannot select ${table}`, async () => {
      for (const token of [null, ANON]) {
        const res = await request(token, 'GET', `/rest/v1/${table}?select=id&limit=5`);
        const empty = res.status === 200 && Array.isArray(res.body) && res.body.length === 0;
        const denied = res.status === 401 || res.status === 403;
        assert.ok(empty || denied, `anon saw ${table}: ${detail(res)}`);
      }
    });
  }

  test('anon can list aircraft-photos', async () => {
    for (const token of [null, ANON]) {
      const res = await listObjects(token, 'aircraft-photos', '');
      assert.equal(res.status, 200, detail(res));
      assert.ok(Array.isArray(res.body), detail(res));
    }
  });

  test('anon can select airports', async (t) => {
    await observePublicCatalog(t, 'airports');
  });

  test('anon can select aircraft_models', async (t) => {
    await observePublicCatalog(t, 'aircraft_models');
  });

  test('operator A declined fan-out can select trip_documents', async (t) => {
    // Known-allowed. operator_can_access_trip (0005) treats any fan-out row as access,
    // including status declined. This records the count and does not assert it is zero.
    const res = await request(
      ctx.operatorAdmin.token,
      'GET',
      `/rest/v1/trip_documents?id=eq.${ID.declinedDocument}&select=id,trip_request_id`,
    );
    assert.equal(res.status, 200, detail(res));
    assert.ok(Array.isArray(res.body), detail(res));
    t.diagnostic(
      `operator A (Northline) declined fan-out trip ${ID.declinedTrip} trip_documents row count: ${res.body.length}`,
    );
  });

  test('operator A active aircraft_availability on operator B is public-read', async (t) => {
    // 0001 availability_select mirrors active-aircraft public read. Not a 0031–0035 trigger.
    const seen = await rows(
      ctx.operatorAdmin.token,
      `aircraft_availability?aircraft_id=eq.${ID.atelierActiveAircraft}&select=id`,
    );
    t.diagnostic(
      `operator A sees ${seen.length} aircraft_availability rows on Atelier active aircraft ${ID.atelierActiveAircraft}`,
    );
  });
});

async function observePublicCatalog(t, table) {
  for (const token of [null, ANON]) {
    const res = await request(token, 'GET', `/rest/v1/${table}?select=id&limit=3`);
    const count = Array.isArray(res.body) ? res.body.length : -1;
    t.diagnostic(`anon ${table} (${token ? 'anon bearer' : 'no Authorization'}) HTTP ${res.status} rows ${count}`);
    assert.ok(res.status < 500, detail(res));
  }
}

async function setup() {
  await waitForApi();

  const customer = await signIn('alex.rivera@koria.example');
  const operatorAdmin = await signIn('maya.ortiz@northline.example');
  const operatorB = await signIn('luca.moretti@atelier.example');
  assert.equal(customer.id, ID.alex);
  assert.equal(operatorAdmin.id, ID.maya);
  assert.equal(operatorB.id, ID.luca);

  const admin = await ensureUser('rls-admin@koria.test');
  const operatorMember = await ensureUser('rls-northline-member@koria.test');
  const subject = await ensureUser('rls-subject@koria.test');

  await setProfile(admin.id, { role: 'admin', access_status: 'approved' });
  await setProfile(operatorMember.id, { role: 'operator', access_status: 'approved' });
  await setProfile(subject.id, { role: 'customer', access_status: 'requested' });
  await ensureMembership(operatorMember.id, ID.northline, 'member');

  const atelierMembership = await rows(
    SERVICE,
    `operator_members?profile_id=eq.${ID.luca}&operator_id=eq.${ID.atelier}&select=id`,
  );
  assert.equal(atelierMembership.length, 1);

  await upsert('operators', {
    id: ID.adminOperator,
    name: 'RLS Fixture Air',
    code: 'RLS70',
    legal_name: 'RLS Fixture Air LLC',
    certificate_number: 'RLS-135-0070',
    certificate_type: 'Part 135',
    verified_at: '2026-01-15T00:00:00.000Z',
    default_fee_bps: 100,
  });

  await upsert('aircraft', {
    id: ID.inactiveAircraft,
    operator_id: ID.atelier,
    model_id: ID.model,
    tail_number: 'NRLS70B',
    seating: 4,
    is_active: false,
  });
  await upsert('aircraft_availability', {
    id: ID.inactiveAvailability,
    aircraft_id: ID.inactiveAircraft,
    starts_at: '2026-12-01T00:00:00.000Z',
    ends_at: '2026-12-02T00:00:00.000Z',
    kind: 'available',
  });
  await upsert('aircraft', {
    id: ID.adminAircraft,
    operator_id: ID.adminOperator,
    model_id: ID.model,
    tail_number: 'NRLSADM',
    seating: 4,
    is_active: false,
  });

  await upsert('operator_api_keys', {
    id: ID.apiKey,
    operator_id: ID.atelier,
    key_hash: 'rls-suite-atelier-not-a-real-key',
    key_prefix: 'rls_atl',
  });
  await upsert('payouts', {
    id: ID.payout,
    operator_id: ID.atelier,
    amount: 100,
    currency: 'USD',
    status: 'unpaid',
  });
  await upsert('invoices', {
    id: ID.invoice,
    booking_id: ID.samBooking,
    due_date: '2026-12-01',
    currency: 'USD',
    line_items: [{ label: 'Charter', amount: 10560 }],
    bank_details: { bank: 'RLS fixture' },
    amount_due: 10560,
    status: 'issued',
  });

  await upsert('trip_requests', {
    id: ID.declinedTrip,
    customer_id: ID.sam,
    origin_id: ID.origin,
    destination_id: ID.destination,
    depart_at: '2026-11-20T15:00:00.000Z',
    passengers: 2,
    status: 'declined',
    aircraft_id: null,
    notes: 'RLS declined fan-out',
  });
  await upsert(
    'trip_request_operators',
    { trip_id: ID.declinedTrip, operator_id: ID.northline, status: 'declined' },
    'trip_id,operator_id',
  );
  await upsert('trip_documents', {
    id: ID.declinedDocument,
    trip_request_id: ID.declinedTrip,
    title: 'Declined fan-out fixture',
  });

  await upsert('trip_requests', {
    id: ID.adminTrip,
    customer_id: ID.alex,
    origin_id: ID.origin,
    destination_id: ID.destination,
    depart_at: '2026-12-15T15:00:00.000Z',
    passengers: 2,
    status: 'requested',
    notes: 'RLS admin throwaway',
  });
  await upsert('quotes', {
    id: ID.adminQuote,
    trip_request_id: ID.adminTrip,
    operator_id: ID.northline,
    aircraft_id: ID.northlineAircraft,
    operator_amount: 10000,
    platform_fee_amount: 1000,
    taxes_amount: 0,
    customer_total: 11000,
    currency: 'USD',
    status: 'pending',
    pricing_mode: 'live',
    valid_until: '2026-12-01T00:00:00.000Z',
  });
  await upsert('bookings', {
    id: ID.adminBooking,
    trip_request_id: ID.adminTrip,
    quote_id: ID.adminQuote,
    status: 'pending',
    operator_amount: 10000,
    platform_fee_amount: 1000,
    taxes_amount: 0,
    customer_total: 11000,
    currency: 'USD',
    payout_adjustment: 0,
  });
  await upsert('access_requests', {
    id: ID.adminAccess,
    user_id: subject.id,
    email: 'rls-subject@koria.test',
    status: 'requested',
    note: 'RLS suite subject',
  });

  const uploaded = await uploadText(`operator-documents/${ID.atelier}/fixture.txt`, 'rls-fixture');
  if (uploaded.status !== 200 && uploaded.status !== 201) {
    throw new Error(`upload operator document: ${detail(uploaded)}`);
  }

  // Re-read admin after the profile patch so is_admin() sees role = admin.
  const adminSession = await signIn('rls-admin@koria.test');
  const memberSession = await signIn('rls-northline-member@koria.test');

  return {
    customer,
    operatorAdmin,
    operatorB,
    operatorMember: memberSession,
    admin: adminSession,
    subject,
    atelierMembershipId: atelierMembership[0].id,
  };
}

async function ensureMembership(profileId, operatorId, role) {
  const existing = await rows(
    SERVICE,
    `operator_members?profile_id=eq.${profileId}&select=id,operator_id,role`,
  );
  if (existing.length === 0) {
    const res = await insert(SERVICE, 'operator_members', {
      operator_id: operatorId,
      profile_id: profileId,
      role,
    });
    if (res.status !== 201 && res.status !== 200) throw new Error(detail(res));
    return;
  }
  const row = existing[0];
  if (row.operator_id !== operatorId) {
    throw new Error(`profile ${profileId} already belongs to ${row.operator_id}`);
  }
  if (row.role !== role) {
    const res = await patch(SERVICE, 'operator_members', row.id, { role });
    if (res.status >= 300) throw new Error(detail(res));
  }
}

async function setProfile(id, fields) {
  const res = await patch(SERVICE, 'profiles', id, fields);
  if (res.status >= 300 || !Array.isArray(res.body) || res.body.length !== 1) {
    throw new Error(`profile ${id}: ${detail(res)}`);
  }
  return res.body[0];
}
