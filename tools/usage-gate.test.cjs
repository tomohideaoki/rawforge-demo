'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { admitTranslation, MemoryLedger } = require('./usage-gate.cjs');
const base = { text: '今日は欠席します。', actorId: 'verified:demo', now: new Date('2026-10-24T00:00:00Z'),
  config: { enabled: true, globalDailyLimit: 3, actorDailyLimit: 2 } };
const run = (args = {}) => admitTranslation({ ...base, ledger: new MemoryLedger(), ...args });
test('default is disabled, no ledger access', async () => {
  const ledger = { reserve() { throw Error('should not run'); } };
  assert.equal((await run({ config: undefined, ledger })).reason, 'disabled');
});
test('reject invalid configuration including zero/negative/noninteger', async () => {
  for (const globalDailyLimit of [0, -1, 1.2, '3', Infinity, undefined]) {
    assert.equal((await run({ config: { ...base.config, globalDailyLimit } })).reason, 'invalid_config');
  }
});
test('reject empty/oversized input before touching ledger', async () => {
  for (const text of ['', ' ', 'あ'.repeat(1001), null]) {
    assert.equal((await run({ text })).reason, 'invalid_text');
  }
});
test('accept 1000 characters boundary', async () => {
  assert.equal((await run({ text: 'あ'.repeat(1000) })).allowed, true);
});
test('reject missing or malformed actor identity', async () => {
  for (const actorId of ['', 'x y', 'x@a.com', null]) {
    assert.equal((await run({ actorId })).reason, 'unverified_actor');
  }
});
test('reject missing ledger, ledger exceptions and invalid clock', async () => {
  assert.equal((await run({ ledger: undefined })).reason, 'missing_atomic_ledger');
  assert.equal((await run({ ledger: { async reserve() { throw Error('offline'); } } })).reason, 'ledger_unavailable');
  assert.equal((await run({ now: new Date('invalid') })).reason, 'invalid_time');
});
test('enforce per-actor quota', async () => {
  const ledger = new MemoryLedger();
  assert.equal((await run({ ledger })).allowed, true);
  assert.equal((await run({ ledger })).allowed, true);
  assert.equal((await run({ ledger })).reason, 'quota_exceeded');
});
test('enforce global quota across actors', async () => {
  const ledger = new MemoryLedger();
  for (let i = 0; i < 3; i++) assert.equal((await run({ ledger, actorId: 'verified:' + i })).allowed, true);
  assert.equal((await run({ ledger, actorId: 'verified:4' })).reason, 'quota_exceeded');
});
test('reset on new UTC day', async () => {
  const ledger = new MemoryLedger();
  const config = { enabled: true, globalDailyLimit: 1, actorDailyLimit: 1 };
  assert.equal((await run({ ledger, config })).allowed, true);
  assert.equal((await run({ ledger, config })).allowed, false);
  assert.equal((await run({ ledger, config, now: new Date('2026-10-25T00:00:00Z') })).allowed, true);
});
test('parallel calls cannot exceed test-ledger global limit in one process', async () => {
  const ledger = new MemoryLedger();
  const results = await Promise.all(Array.from({ length: 100 }, (_, i) => run({ ledger, actorId: 'verified:' + i })));
  assert.equal(results.filter(x => x.allowed).length, 3);
});
test('a reserved call stays counted even if a later AI operation fails', async () => {
  const ledger = new MemoryLedger();
  const config = { enabled: true, globalDailyLimit: 1, actorDailyLimit: 1 };
  assert.equal((await run({ ledger, config })).allowed, true);
  // No release/refund method: avoid overspending if a provider bills for failed calls.
  assert.equal((await run({ ledger, config })).reason, 'quota_exceeded');
});
