'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { makeOfflineMockHandler } = require('../experiments/mock-worker-handler.mjs');
const now = new Date('2026-10-28T01:00:00Z');
function quota() {
  let used = 0;
  return { reserve: async ({ limit }) => { if (used >= limit) return false; used++; return true; }, get used() { return used; } };
}
const request = (body, opts = {}) => new Request('https://offline.invalid/', {
  method: opts.method || 'POST',
  headers: { 'Content-Type': opts.contentType || 'application/json' },
  ...(opts.method === 'GET' ? {} : { body: typeof body === 'string' ? body : JSON.stringify(body) }),
});
const valid = { text: '今日は欠席します', consent: true };
function setup(config = {}) {
  const store = quota();
  return { store, handle: makeOfflineMockHandler({ enabled: true, maxDailyRequests: 2, reserve: store.reserve, now, ...config }) };
}

test('disabled by default: rejects before reading or reserving', async () => {
  const store = quota(); const handle = makeOfflineMockHandler({ reserve: store.reserve, maxDailyRequests: 2 });
  const r = await handle(request(valid)); assert.equal(r.status, 503); assert.equal(store.used, 0);
});
test('GET is rejected and does not reserve', async () => {
  const { handle, store } = setup(); assert.equal((await handle(request(null, { method: 'GET' }))).status, 405); assert.equal(store.used, 0);
});
test('wrong content type is rejected before parsing', async () => {
  const { handle, store } = setup(); assert.equal((await handle(request(valid, { contentType: 'text/plain' }))).status, 415); assert.equal(store.used, 0);
});
test('invalid JSON is rejected before reserving', async () => {
  const { handle, store } = setup(); assert.equal((await handle(request('{bad'))).status, 400); assert.equal(store.used, 0);
});
test('oversized request is rejected before reserving', async () => {
  const { handle, store } = setup(); assert.equal((await handle(request({ text: 'あ'.repeat(4000), consent: true }))).status, 413); assert.equal(store.used, 0);
});
test('consent required and legacy v1 payload rejected', async () => {
  const { handle, store } = setup(); const r = await handle(request({ text: valid.text }));
  assert.equal(r.status, 400); assert.equal((await r.json()).error, 'CONSENT_REQUIRED'); assert.equal(store.used, 0);
});
test('empty text and 1001 code points rejected', async () => {
  const { handle, store } = setup();
  assert.equal((await handle(request({ text: '  ', consent: true }))).status, 400);
  assert.equal((await handle(request({ text: 'あ'.repeat(1001), consent: true }))).status, 400);
  assert.equal(store.used, 0);
});
test('600 supplementary Unicode code points accepted, mock fixture only', async () => {
  const { handle, store } = setup(); const r = await handle(request({ text: '😀'.repeat(600), consent: true }));
  assert.equal(r.status, 200); assert.match((await r.json()).english, /NOT A TRANSLATION/); assert.equal(store.used, 1);
});
test('two admissions, third rejected 429, no input echoed', async () => {
  const { handle, store } = setup();
  for (let i = 0; i < 2; i++) {
    const r = await handle(request(valid)); assert.equal(r.status, 200);
    const body = await r.text(); assert.ok(!body.includes(valid.text));
    assert.equal(r.headers.get('Cache-Control'), 'no-store');
  }
  const r = await handle(request(valid)); assert.equal(r.status, 429);
  assert.equal((await r.json()).error, 'DAILY_QUOTA_EXHAUSTED'); assert.equal(store.used, 2);
});
test('missing atomic store fails closed', async () => {
  const handle = makeOfflineMockHandler({ enabled: true, maxDailyRequests: 2, now });
  assert.equal((await handle(request(valid))).status, 503);
});
test('storage failure fails closed without input reflection', async () => {
  const handle = makeOfflineMockHandler({ enabled: true, maxDailyRequests: 2, now, reserve: async () => { throw Error('private-db-secret'); } });
  const r = await handle(request(valid)); assert.equal(r.status, 503);
  assert.ok(!(await r.text()).includes('private-db-secret'));
});
test('invalid store result fails closed', async () => {
  const handle = makeOfflineMockHandler({ enabled: true, maxDailyRequests: 2, now, reserve: async () => undefined });
  assert.equal((await handle(request(valid))).status, 503);
});
test('never attempts outbound network even on allowed request', async () => {
  const { handle } = setup(); const oldFetch = global.fetch;
  global.fetch = () => { throw Error('Unexpected external network call'); };
  try { assert.equal((await handle(request(valid))).status, 200); }
  finally { global.fetch = oldFetch; }
});

test('malformed UTF-8 is rejected without quota reservation', async () => {
  const { handle, store } = setup();
  const req = new Request('https://offline.invalid/', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: new Uint8Array([0xff, 0xfe]) });
  assert.equal((await handle(req)).status, 400); assert.equal(store.used, 0);
});
test('declared oversized Content-Length rejected before reading', async () => {
  const { handle, store } = setup();
  const req = new Request('https://offline.invalid/', { method: 'POST', headers: { 'Content-Type': 'application/json', 'Content-Length': '99999' }, body: JSON.stringify(valid) });
  assert.equal((await handle(req)).status, 413); assert.equal(store.used, 0);
});

test('full offline handler + SQLite admission: concurrent 50 requests obey cap 3', async () => {
  const { DatabaseSync } = require('node:sqlite');
  const { makeSqliteReserve } = await import('../experiments/sqlite-reservation.mjs');
  const db = new DatabaseSync(':memory:');
  try {
    const sql = { exec(query, ...params) {
      if (params.length) return { toArray: () => db.prepare(query).all(...params) };
      db.exec(query); return { toArray: () => [] };
    } };
    const handle = makeOfflineMockHandler({ enabled: true, maxDailyRequests: 3, reserve: makeSqliteReserve(sql), now });
    const responses = await Promise.all(Array.from({ length: 50 }, () => handle(request(valid))));
    assert.equal(responses.filter(r => r.status === 200).length, 3);
    assert.equal(responses.filter(r => r.status === 429).length, 47);
    assert.equal(db.prepare('SELECT used FROM translation_quota').get().used, 3);
  } finally { db.close(); }
});
