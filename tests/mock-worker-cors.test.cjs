'use strict';
/** Offline browser CORS contract tests; no network, AI, Worker or secrets. */
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { makeOfflineMockHandler } = require('../experiments/mock-worker-handler.mjs');
const SITE = 'https://tomohideaoki.github.io';
const now = new Date('2026-11-02T00:00:00Z');
function setup(opts = {}) {
  let used = 0;
  const handle = makeOfflineMockHandler({
    enabled: true, maxDailyRequests: 2,
    reserve: async ({ limit }) => { if (used >= limit) return false; used++; return true; },
    now, ...opts,
  });
  return { handle, get used() { return used; } };
}
function preflight(origin = SITE, method = 'POST', headers = 'content-type') {
  return new Request('https://offline.invalid/', {
    method: 'OPTIONS', headers: {
      ...(origin === null ? {} : { Origin: origin }),
      'Access-Control-Request-Method': method,
      'Access-Control-Request-Headers': headers,
    },
  });
}
function post(origin = SITE, body = { text: '明日は欠席します', consent: true }) {
  return new Request('https://offline.invalid/', {
    method: 'POST', headers: {
      'Content-Type': 'application/json',
      ...(origin === null ? {} : { Origin: origin }),
    }, body: JSON.stringify(body),
  });
}
test('valid browser preflight succeeds without reading input or reserving quota', async () => {
  const s = setup(); const r = await s.handle(preflight());
  assert.equal(r.status, 204); assert.equal(s.used, 0);
  assert.equal(r.headers.get('Access-Control-Allow-Origin'), SITE);
  assert.equal(r.headers.get('Access-Control-Allow-Methods'), 'POST');
  assert.equal(r.headers.get('Access-Control-Allow-Headers'), 'Content-Type');
  assert.equal(r.headers.get('Vary'), 'Origin');
  assert.equal(r.headers.get('Access-Control-Allow-Credentials'), null);
});
test('preflight rejects foreign origin without CORS permission or quota', async () => {
  const s = setup(); const r = await s.handle(preflight('https://attacker.invalid'));
  assert.equal(r.status, 403); assert.equal(r.headers.get('Access-Control-Allow-Origin'), null);
  assert.equal(s.used, 0);
});
test('preflight rejects missing Origin', async () => {
  const s = setup(); assert.equal((await s.handle(preflight(null))).status, 403); assert.equal(s.used, 0);
});
test('preflight rejects GET and unexpected headers without quota', async () => {
  const s = setup();
  assert.equal((await s.handle(preflight(SITE, 'GET'))).status, 403);
  assert.equal((await s.handle(preflight(SITE, 'POST', 'content-type, authorization'))).status, 403);
  assert.equal(s.used, 0);
});
test('allowed browser POST returns CORS header and uses exactly one reservation', async () => {
  const s = setup(); const r = await s.handle(post());
  assert.equal(r.status, 200); assert.equal(r.headers.get('Access-Control-Allow-Origin'), SITE);
  assert.match((await r.json()).english, /NOT A TRANSLATION/); assert.equal(s.used, 1);
});
test('unknown Origin POST is rejected before reserving', async () => {
  const s = setup(); const r = await s.handle(post('https://attacker.invalid'));
  assert.equal(r.status, 403); assert.equal(r.headers.get('Access-Control-Allow-Origin'), null);
  assert.equal(s.used, 0);
});
test('allowed origin receives CORS headers even on 400/429/503', async () => {
  const s = setup();
  const invalid = await s.handle(post(SITE, { text: '欠席', consent: false }));
  assert.equal(invalid.status, 400); assert.equal(invalid.headers.get('Access-Control-Allow-Origin'), SITE);
  assert.equal(s.used, 0);
  await s.handle(post()); await s.handle(post());
  const exhausted = await s.handle(post());
  assert.equal(exhausted.status, 429); assert.equal(exhausted.headers.get('Access-Control-Allow-Origin'), SITE);
  const disabled = await setup({ enabled: false }).handle(post());
  assert.equal(disabled.status, 503); assert.equal(disabled.headers.get('Access-Control-Allow-Origin'), SITE);
});
test('requests without Origin are not authenticated by CORS; production auth still required', async () => {
  const s = setup(); const r = await s.handle(post(null));
  assert.equal(r.status, 200); assert.equal(r.headers.get('Access-Control-Allow-Origin'), null);
  assert.equal(s.used, 1);
});
test('CORS handler makes no outbound fetch', async () => {
  const s = setup(); const oldFetch = global.fetch;
  global.fetch = () => { throw Error('Network not allowed'); };
  try { assert.equal((await s.handle(post())).status, 200); }
  finally { global.fetch = oldFetch; }
});
