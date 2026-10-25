'use strict';
// Offline integration tests of the actual usage-gate + atomic-ledger modules.
// This is NOT a Cloudflare integration test: FakeStorage serializes transactions in-process.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { admitTranslation } = require('./usage-gate.cjs');
const { AtomicLedger } = require('./atomic-ledger.cjs');

class FakeStorage {
  constructor() { this.data = new Map(); this.queue = Promise.resolve(); }
  transaction(fn) {
    const task = this.queue.then(async () => {
      const snapshot = new Map(this.data);
      const txn = {
        get: async key => snapshot.get(key),
        put: async (key, value) => { snapshot.set(key, value); }
      };
      const result = await fn(txn);
      this.data = snapshot;
      return result;
    });
    this.queue = task.catch(() => {});
    return task;
  }
}
const config = Object.freeze({ enabled: true, globalDailyLimit: 3, actorDailyLimit: 2 });
const date = new Date('2026-10-25T08:00:00.000Z');
const input = { text: '今日は欠席します。', actorId: 'verified:demo', now: date, config };
const make = () => new AtomicLedger(new FakeStorage());
const admit = (ledger, overrides = {}) => admitTranslation({ ...input, ledger, ...overrides });

test('disabled by default, without calling storage', async () => {
  const ledger = { reserve: () => { throw Error('unexpected'); } };
  assert.deepEqual(await admit(ledger, { config: undefined }), { allowed: false, reason: 'disabled' });
});
test('accepted request reserves quota and then denies the third request for the same actor', async () => {
  const ledger = make();
  assert.equal((await admit(ledger)).reason, 'reserved');
  assert.equal((await admit(ledger)).reason, 'reserved');
  assert.equal((await admit(ledger)).reason, 'quota_exceeded');
});
test('global quota is shared across distinct actors', async () => {
  const ledger = make();
  for (const actorId of ['verified:a', 'verified:b', 'verified:c']) {
    assert.equal((await admit(ledger, { actorId })).allowed, true);
  }
  assert.equal((await admit(ledger, { actorId: 'verified:d' })).reason, 'quota_exceeded');
});
test('100 parallel admissions reserve at most the global limit', async () => {
  const ledger = make();
  const results = await Promise.all(Array.from({ length: 100 }, (_, i) =>
    admit(ledger, { actorId: 'verified:' + i })));
  assert.equal(results.filter(r => r.allowed).length, 3);
  assert.equal(results.filter(r => r.reason === 'quota_exceeded').length, 97);
});
test('bad input, invalid config, and missing actor do not reserve quota', async () => {
  const ledger = make();
  assert.equal((await admit(ledger, { text: ' ' })).reason, 'invalid_text');
  assert.equal((await admit(ledger, { actorId: ' ' })).reason, 'unverified_actor');
  assert.equal((await admit(ledger, { config: { ...config, globalDailyLimit: 0 } })).reason, 'invalid_config');
  assert.equal((await admit(ledger, { text: 'あ'.repeat(1001) })).reason, 'invalid_text');
  assert.equal((await admit(ledger)).reason, 'reserved');
});
test('storage outage denies request without permitting AI call', async () => {
  const ledger = new AtomicLedger({ transaction: async () => { throw Error('storage unavailable'); } });
  assert.equal((await admit(ledger)).reason, 'ledger_unavailable');
});
test('UTC day changes reservation namespace', async () => {
  const ledger = make();
  const one = { ...config, globalDailyLimit: 1, actorDailyLimit: 1 };
  assert.equal((await admit(ledger, { config: one })).allowed, true);
  assert.equal((await admit(ledger, { config: one })).allowed, false);
  assert.equal((await admit(ledger, { config: one, now: new Date('2026-10-26T00:00:00.000Z') })).allowed, true);
});
test('failed downstream operation does not refund the reservation', async () => {
  const ledger = make();
  const one = { ...config, globalDailyLimit: 1, actorDailyLimit: 1 };
  assert.equal((await admit(ledger, { config: one })).allowed, true);
  // Simulate a failed operation *after* reservation. No refund API is provided.
  assert.equal((await admit(ledger, { config: one })).reason, 'quota_exceeded');
});
