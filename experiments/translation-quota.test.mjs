import test from 'node:test';
import assert from 'node:assert/strict';
import { authorizeTranslation } from './translation-quota.mjs';

function atomicCounter() {
  const counts = new Map();
  return {
    counts,
    async reserve({ key, limit }) {
      const n = counts.get(key) ?? 0;
      if (n >= limit) return false;
      counts.set(key, n + 1);
      return true;
    }
  };
}
const valid = () => ({ enabled: true, maxDailyRequests: 2, reserve: atomicCounter().reserve, payload: { text: '  欠席します  ', consent: true }, now: new Date('2026-10-26T23:00:00Z') });

test('disabled by default, does not reserve', async () => {
  let called = false;
  const r = await authorizeTranslation({ reserve: async () => { called = true; return true; }, payload: { text: 'x', consent: true } });
  assert.equal(r.reason, 'TRANSLATION_DISABLED'); assert.equal(called, false);
});
test('missing, zero, and invalid quota fail closed', async () => {
  for (const maxDailyRequests of [undefined, 0, -1, 1.2, 1001, '2']) {
    const r = await authorizeTranslation({ ...valid(), maxDailyRequests });
    assert.equal(r.reason, 'QUOTA_NOT_CONFIGURED');
  }
});
test('no atomic store fails closed', async () => {
  assert.equal((await authorizeTranslation({ ...valid(), reserve: undefined })).reason, 'ATOMIC_STORE_NOT_CONFIGURED');
});
test('consent required, no reservation', async () => {
  let called = false;
  const r = await authorizeTranslation({ ...valid(), payload: { text: '欠席' }, reserve: async () => { called = true; return true; } });
  assert.equal(r.reason, 'CONSENT_REQUIRED'); assert.equal(called, false);
});
test('missing or blank text rejected', async () => {
  for (const text of [undefined, '', '  ']) {
    const r = await authorizeTranslation({ ...valid(), payload: { text, consent: true } });
    assert.equal(r.status, 400);
  }
});
test('unicode character limit at 1000, trim output', async () => {
  const r = await authorizeTranslation(valid());
  assert.equal(r.allowed, true); assert.equal(r.text, '欠席します');
  assert.equal((await authorizeTranslation({ ...valid(), payload: { text: 'あ'.repeat(1001), consent: true } })).reason, 'INVALID_TEXT_LENGTH');
  assert.equal((await authorizeTranslation({ ...valid(), payload: { text: 'あ'.repeat(1000), consent: true } })).allowed, true);
});
test('daily quota blocks third request and never over-reserves', async () => {
  const store = atomicCounter();
  const opts = { ...valid(), reserve: store.reserve };
  const result = await Promise.all(Array.from({ length: 20 }, () => authorizeTranslation(opts)));
  assert.equal(result.filter(r => r.allowed).length, 2);
  assert.equal(result.filter(r => r.reason === 'DAILY_QUOTA_EXHAUSTED').length, 18);
  assert.equal([...store.counts.values()][0], 2);
});
test('UTC midnight changes quota bucket', async () => {
  const store = atomicCounter();
  const a = { ...valid(), maxDailyRequests: 1, reserve: store.reserve };
  assert.equal((await authorizeTranslation({ ...a, now: new Date('2026-10-26T23:59:59Z') })).allowed, true);
  assert.equal((await authorizeTranslation({ ...a, now: new Date('2026-10-27T00:00:00Z') })).allowed, true);
  assert.equal(store.counts.size, 2);
});
test('store errors and unexpected results fail closed', async () => {
  const a = valid();
  assert.equal((await authorizeTranslation({ ...a, reserve: async () => { throw Error('fail'); } })).reason, 'ATOMIC_STORE_UNAVAILABLE');
  assert.equal((await authorizeTranslation({ ...a, reserve: async () => undefined })).reason, 'ATOMIC_STORE_INVALID_RESULT');
});
test('invalid clock fails closed', async () => {
  assert.equal((await authorizeTranslation({ ...valid(), now: new Date('invalid') })).reason, 'INVALID_CLOCK');
});
