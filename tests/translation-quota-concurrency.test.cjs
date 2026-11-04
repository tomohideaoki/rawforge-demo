'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { pathToFileURL } = require('node:url');
const { resolve } = require('node:path');
const moduleUrl = pathToFileURL(resolve(__dirname, '../experiments/translation-quota.mjs')).href;
const payload = { text: '学校を欠席します。', consent: true };

test('100 simultaneous requests never exceed a 7-request atomic daily cap', async () => {
  const { authorizeTranslation } = await import(moduleUrl);
  let used = 0;
  // The synchronous check-and-increment models an atomic durable reservation.
  // This does NOT verify real Cloudflare storage or cross-instance atomicity.
  const reserve = async ({ limit }) => {
    if (used >= limit) return false;
    used++;
    return true;
  };
  const results = await Promise.all(Array.from({ length: 100 }, () =>
    authorizeTranslation({ enabled: true, maxDailyRequests: 7, reserve, payload,
      now: new Date('2026-11-04T00:00:00.000Z') })));
  assert.equal(results.filter(x => x.allowed).length, 7);
  assert.equal(results.filter(x => x.status === 429).length, 93);
  assert.equal(used, 7);
});

test('rejects missing atomic store before admitting any translation', async () => {
  const { authorizeTranslation } = await import(moduleUrl);
  const result = await authorizeTranslation({ enabled: true, maxDailyRequests: 7, payload });
  assert.deepEqual(result, { allowed: false, status: 503, reason: 'ATOMIC_STORE_NOT_CONFIGURED' });
});

test('refuses an invalid reservation response instead of spending', async () => {
  const { authorizeTranslation } = await import(moduleUrl);
  const result = await authorizeTranslation({ enabled: true, maxDailyRequests: 7,
    payload, reserve: async () => undefined });
  assert.equal(result.allowed, false);
  assert.equal(result.status, 503);
});
