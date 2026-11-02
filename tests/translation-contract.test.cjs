'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const { join } = require('node:path');
const gate = import('../experiments/translation-quota.mjs');
const valid = { text: '欠席します', consent: true };
const now = new Date('2026-10-27T00:00:00Z');
function counter() {
  let count = 0;
  return { reserve: async ({ limit }) => { if (count >= limit) return false; count++; return true; }, get count() { return count; } };
}
test('frontend stays disabled and sends consent in v2 payload', () => {
  const html = readFileSync(join(__dirname, '..', 'index.html'), 'utf8');
  assert.match(html, /const GP_TRANSLATION_ENABLED = false;/);
  assert.match(html, /body: JSON\.stringify\(\{ text, consent: true \}\)/);
  assert.match(html, /Array\.from\(text\)\.length > 1000/);
});
test('disabled gate rejects without using quota', async () => {
  const { authorizeTranslation } = await gate;
  const store = counter();
  const r = await authorizeTranslation({ payload: valid, reserve: store.reserve, maxDailyRequests: 2 });
  assert.equal(r.reason, 'TRANSLATION_DISABLED');
  assert.equal(store.count, 0);
});
test('v2 client payload passes validation with a fake atomic store only', async () => {
  const { authorizeTranslation } = await gate;
  const store = counter();
  const r = await authorizeTranslation({ enabled: true, payload: JSON.parse(JSON.stringify(valid)), reserve: store.reserve, maxDailyRequests: 2, now });
  assert.deepEqual(r, { allowed: true, status: 200, text: '欠席します' });
  assert.equal(store.count, 1);
});
test('legacy v1 payload is rejected without consuming quota', async () => {
  const { authorizeTranslation } = await gate;
  const store = counter();
  const r = await authorizeTranslation({ enabled: true, payload: { text: '欠席します' }, reserve: store.reserve, maxDailyRequests: 2, now });
  assert.equal(r.reason, 'CONSENT_REQUIRED');
  assert.equal(store.count, 0);
});
test('missing persistent counter fails closed', async () => {
  const { authorizeTranslation } = await gate;
  const r = await authorizeTranslation({ enabled: true, payload: valid, maxDailyRequests: 2, now });
  assert.equal(r.reason, 'ATOMIC_STORE_NOT_CONFIGURED');
});
test('daily cap denies further requests with fake atomic store', async () => {
  const { authorizeTranslation } = await gate;
  const store = counter();
  const args = { enabled: true, payload: valid, maxDailyRequests: 2, reserve: store.reserve, now };
  assert.equal((await authorizeTranslation(args)).allowed, true);
  assert.equal((await authorizeTranslation(args)).allowed, true);
  assert.equal((await authorizeTranslation(args)).reason, 'DAILY_QUOTA_EXHAUSTED');
  assert.equal(store.count, 2);
});
