// PostgREST helpers for the RLS suite. No npm dependencies.
// JWTs come from GoTrue password grants (seed password koria-demo), not hand-minted tokens.

import assert from 'node:assert/strict';

export const URL = process.env.SUPABASE_URL ?? 'http://127.0.0.1:54321';
export const ANON =
  process.env.SUPABASE_ANON_KEY ??
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0';
export const SERVICE =
  process.env.SUPABASE_SERVICE_ROLE_KEY ??
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU';

export const PASSWORD = 'koria-demo';

// Operator A is Northline (Maya Ortiz, seeded operator admin). Operator B is Atelier (Luca Moretti).
export const ID = {
  alex: '66666666-6666-6666-6666-666666660001',
  sam: '66666666-6666-6666-6666-666666660002',
  maya: '66666666-6666-6666-6666-666666660004',
  luca: '66666666-6666-6666-6666-666666660005',
  northline: '44444444-4444-4444-4444-444444440002',
  atelier: '44444444-4444-4444-4444-444444440003',
  model: '22222222-2222-2222-2222-222222220001',
  origin: '11111111-1111-1111-1111-111111110001',
  destination: '11111111-1111-1111-1111-111111110002',
  alexOpenTrip: '77777777-7777-7777-7777-777777770001',
  alexQuote: '88888888-8888-8888-8888-888888880002',
  alexAccess: '13131313-1313-1313-1313-131313130001',
  alexNotification: 'ffffffff-ffff-ffff-ffff-ffffffffff01',
  northlineAircraft: '55555555-5555-5555-5555-555555550001',
  northlineBooking: '99999999-9999-9999-9999-999999990005',
  northlineTrip: '77777777-7777-7777-7777-777777770005',
  samTrip: '77777777-7777-7777-7777-777777770009',
  samBooking: '99999999-9999-9999-9999-99999999000b',
  samPayment: '14141414-1414-1414-1414-14141414000b',
  samPassenger: 'dddddddd-dddd-dddd-dddd-dddddddddd03',
  samNotification: 'ffffffff-ffff-ffff-ffff-ffffffffff04',
  atelierActiveAircraft: '55555555-5555-5555-5555-555555550003',
  inactiveAircraft: '55555555-5555-5555-5555-55555555a070',
  inactiveAvailability: 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbb070',
  apiKey: 'a1a1a1a1-a1a1-a1a1-a1a1-a1a1a1a1a070',
  payout: '15151515-1515-1515-1515-151515150070',
  invoice: '17171717-1717-1717-1717-171717170070',
  declinedTrip: '77777777-7777-7777-7777-777777770070',
  declinedDocument: '18181818-1818-1818-1818-181818180070',
  quoteInsert: '88888888-8888-8888-8888-888888880070',
  documentInsert: '18181818-1818-1818-1818-181818180071',
  aircraftInsert: '55555555-5555-5555-5555-55555555a072',
  adminOperator: '44444444-4444-4444-4444-444444440070',
  adminTrip: '77777777-7777-7777-7777-777777770071',
  adminQuote: '88888888-8888-8888-8888-888888880071',
  adminBooking: '99999999-9999-9999-9999-999999990071',
  adminAircraft: '55555555-5555-5555-5555-55555555a071',
  adminAccess: '13131313-1313-1313-1313-131313130070',
};

export function detail(res) {
  const message =
    res.body && typeof res.body === 'object' && !Array.isArray(res.body) && res.body.message
      ? res.body.message
      : null;
  const encoded = JSON.stringify(res.body);
  return message ? `HTTP ${res.status} ${message} (${encoded})` : `HTTP ${res.status} ${encoded}`;
}

export async function request(token, method, path, { body, prefer, apikey } = {}) {
  const key = apikey ?? (token === SERVICE ? SERVICE : ANON);
  const headers = { apikey: key, Accept: 'application/json' };
  if (token) headers.Authorization = `Bearer ${token}`;
  if (body !== undefined) headers['Content-Type'] = 'application/json';
  if (prefer) headers.Prefer = prefer;
  const res = await fetch(`${URL}${path}`, {
    method,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const text = await res.text();
  let parsed = null;
  if (text) {
    try {
      parsed = JSON.parse(text);
    } catch {
      parsed = text;
    }
  }
  return { status: res.status, body: parsed };
}

export async function waitForApi() {
  const deadline = Date.now() + 60_000;
  let last = 'no response';
  while (Date.now() < deadline) {
    try {
      const rest = await fetch(`${URL}/rest/v1/airports?select=id&limit=1`, {
        headers: { apikey: SERVICE, Authorization: `Bearer ${SERVICE}`, Accept: 'application/json' },
      });
      const auth = await fetch(`${URL}/auth/v1/health`, { headers: { apikey: ANON } });
      const bucket = await fetch(`${URL}/storage/v1/bucket/operator-documents`, {
        headers: { apikey: SERVICE, Authorization: `Bearer ${SERVICE}` },
      });
      last = `rest ${rest.status} auth ${auth.status} storage ${bucket.status}`;
      if (rest.status === 200 && auth.status > 0 && auth.status < 500 && bucket.status === 200) return;
    } catch (error) {
      last = error instanceof Error ? error.message : String(error);
    }
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
  throw new Error(`PostgREST, Auth, or Storage did not become ready within 60s (${last})`);
}

export async function signIn(email, password = PASSWORD) {
  const res = await request(null, 'POST', '/auth/v1/token?grant_type=password', {
    apikey: ANON,
    body: { email, password },
  });
  if (res.status !== 200 || !res.body?.access_token || !res.body?.user?.id) {
    throw new Error(`sign in ${email}: ${detail(res)}`);
  }
  return { id: res.body.user.id, email, token: res.body.access_token };
}

export async function ensureUser(email, password = PASSWORD) {
  const created = await request(SERVICE, 'POST', '/auth/v1/admin/users', {
    apikey: SERVICE,
    body: { email, password, email_confirm: true },
  });
  if (created.status >= 400 && created.status !== 422) {
    throw new Error(`create user ${email}: ${detail(created)}`);
  }
  return signIn(email, password);
}

export async function rows(token, query) {
  const res = await request(token, 'GET', `/rest/v1/${query}`);
  if (res.status !== 200 || !Array.isArray(res.body)) {
    throw new Error(`select ${query}: ${detail(res)}`);
  }
  return res.body;
}

export async function getOne(table, id) {
  const list = await rows(SERVICE, `${table}?id=eq.${id}&select=*`);
  if (list.length !== 1) throw new Error(`expected one ${table} ${id}, got ${list.length}`);
  return list[0];
}

export async function patch(token, table, id, body) {
  return request(token, 'PATCH', `/rest/v1/${table}?id=eq.${id}`, {
    body,
    prefer: 'return=representation',
  });
}

export async function insert(token, table, body) {
  return request(token, 'POST', `/rest/v1/${table}`, {
    body,
    prefer: 'return=representation',
  });
}

export async function upsert(table, row, onConflict = 'id') {
  const res = await request(
    SERVICE,
    'POST',
    `/rest/v1/${table}?on_conflict=${encodeURIComponent(onConflict)}`,
    {
      apikey: SERVICE,
      body: row,
      prefer: 'resolution=merge-duplicates,return=representation',
    },
  );
  if (res.status !== 200 && res.status !== 201) {
    throw new Error(`upsert ${table}: ${detail(res)}`);
  }
  return res.body;
}

export async function del(table, filter) {
  const res = await request(SERVICE, 'DELETE', `/rest/v1/${table}?${filter}`, {
    apikey: SERVICE,
    prefer: 'return=minimal',
  });
  if (res.status !== 200 && res.status !== 204) {
    throw new Error(`delete ${table}?${filter}: ${detail(res)}`);
  }
}

export function normalize(value) {
  if (value === null || value === undefined) return null;
  if (typeof value === 'number') return value;
  if (typeof value === 'string' && /^-?\d+(\.\d+)?$/.test(value)) return Number(value);
  if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}T/.test(value)) return new Date(value).toISOString();
  return value;
}

export async function assertUpdateBlocked(token, table, id, body) {
  const before = await getOne(table, id);
  const columns = Object.keys(body);
  try {
    const res = await patch(token, table, id, body);
    if (res.status === 401) assert.fail(`authentication failed for ${table}: ${detail(res)}`);
    const empty = res.status === 200 && Array.isArray(res.body) && res.body.length === 0;
    const rejected = res.status >= 400 && res.status < 500;
    assert.ok(empty || rejected, `expected ${table} update to be blocked: ${detail(res)}`);
    const after = await getOne(table, id);
    for (const column of columns) {
      assert.deepEqual(
        after[column],
        before[column],
        `${table}.${column} changed after a blocked update: ${detail(res)}`,
      );
    }
  } finally {
    const now = await getOne(table, id);
    const dirty = columns.some((column) => JSON.stringify(now[column]) !== JSON.stringify(before[column]));
    if (dirty) {
      const restore = {};
      for (const column of columns) restore[column] = before[column];
      const back = await patch(SERVICE, table, id, restore);
      if (back.status < 200 || back.status >= 300) {
        throw new Error(`restore ${table} ${id}: ${detail(back)}`);
      }
    }
  }
}

export async function assertUpdateAllowed(token, table, id, body) {
  const before = await getOne(table, id);
  try {
    const res = await patch(token, table, id, body);
    assert.ok(res.status >= 200 && res.status < 300, detail(res));
    assert.ok(Array.isArray(res.body) && res.body.length === 1, `expected one updated row: ${detail(res)}`);
    const after = await getOne(table, id);
    for (const [column, value] of Object.entries(body)) {
      assert.equal(
        normalize(after[column]),
        normalize(value),
        `${table}.${column} did not stick: ${detail(res)}`,
      );
    }
  } finally {
    const restore = {};
    for (const column of Object.keys(body)) restore[column] = before[column];
    const back = await patch(SERVICE, table, id, restore);
    if (back.status < 200 || back.status >= 300) {
      throw new Error(`restore ${table} ${id}: ${detail(back)}`);
    }
  }
}

export async function assertHidden(token, table, id, { alsoVisibleTo } = {}) {
  const fixture = await rows(SERVICE, `${table}?id=eq.${id}&select=id`);
  assert.equal(fixture.length, 1, `fixture ${table} ${id} is missing`);
  if (alsoVisibleTo) {
    const seen = await rows(alsoVisibleTo, `${table}?id=eq.${id}&select=id`);
    assert.equal(seen.length, 1, `control JWT could not see ${table} ${id}`);
  }
  const res = await request(token, 'GET', `/rest/v1/${table}?id=eq.${id}&select=id`);
  assert.equal(res.status, 200, detail(res));
  assert.ok(Array.isArray(res.body), detail(res));
  assert.equal(res.body.length, 0, `${table} ${id} was visible: ${JSON.stringify(res.body)}`);
}

export async function uploadText(objectPath, content) {
  const res = await fetch(`${URL}/storage/v1/object/${objectPath}`, {
    method: 'POST',
    headers: {
      apikey: SERVICE,
      Authorization: `Bearer ${SERVICE}`,
      'Content-Type': 'text/plain',
      'x-upsert': 'true',
    },
    body: content,
  });
  const text = await res.text();
  let parsed = text;
  try {
    parsed = text ? JSON.parse(text) : null;
  } catch {
    parsed = text;
  }
  return { status: res.status, body: parsed };
}

export async function listObjects(token, bucket, prefix) {
  return request(token, 'POST', `/storage/v1/object/list/${bucket}`, {
    body: { prefix, limit: 100, offset: 0, sortBy: { column: 'name', order: 'asc' } },
  });
}
