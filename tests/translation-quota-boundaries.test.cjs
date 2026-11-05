'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { pathToFileURL } = require('node:url');
const { resolve } = require('node:path');
const moduleUrl = pathToFileURL(resolve(__dirname, '../experiments/translation-quota.mjs')).href;
const valid = { text: '欠席します。', consent: true };
const clock = new Date('2026-11-05T23:59:59.000Z');

async function gate(overrides = {}) {
  const { authorizeTranslation } = await import(moduleUrl);
  let calls = 0;
  const args = {
    enabled: true, maxDailyRequests: 7, payload: valid, now: clock,
    reserve: async () => { calls++; return true; }, ...overrides
  };
  return { result: await authorizeTranslation(args), calls };
}

test('disabled and invalid quota configuration fail closed before reservation', async () => {
  for (const options of [{enabled:false}, {maxDailyRequests:0}, {maxDailyRequests:1001},
    {maxDailyRequests:1.5}, {maxDailyRequests:NaN}]) {
    const { result, calls } = await gate(options);
    assert.equal(result.allowed, false);
    assert.equal(result.status, 503);
    assert.equal(calls, 0);
  }
});

test('missing consent, invalid payload and blank text never reserve', async () => {
  for (const payload of [null, {text:'hello'}, {text:'hello',consent:false},
    {text:123,consent:true}, {text:'   ',consent:true}]) {
    const {result,calls} = await gate({payload});
    assert.equal(result.status,400);
    assert.equal(calls,0);
  }
});

test('Unicode code points are counted correctly at 1000 and 1001', async () => {
  const ok = await gate({payload:{text:'😀'.repeat(1000),consent:true}});
  assert.equal(ok.result.allowed,true);
  assert.equal(ok.calls,1);
  const tooLong = await gate({payload:{text:'😀'.repeat(1001),consent:true}});
  assert.equal(tooLong.result.status,400);
  assert.equal(tooLong.calls,0);
});

test('UTC day key and configured cap passed to atomic store without user data', async () => {
  let reservation;
  const {result} = await gate({reserve:async x=>{reservation=x;return true;}});
  assert.equal(result.allowed,true);
  assert.deepEqual(reservation,{key:'gp:translation:2026-11-05',limit:7});
});

test('invalid clock and thrown reservation errors fail closed', async () => {
  const badClock = await gate({now:new Date('invalid')});
  assert.equal(badClock.result.status,503);
  assert.equal(badClock.calls,0);
  const failure = await gate({reserve:async()=>{throw Error('offline');}});
  assert.deepEqual(failure.result,{allowed:false,status:503,reason:'ATOMIC_STORE_UNAVAILABLE'});
});

test('quota exhausted returns 429; non-boolean reservation never authorizes', async () => {
  const exhausted = await gate({reserve:async()=>false});
  assert.equal(exhausted.result.status,429);
  const unexpected = await gate({reserve:async()=>1});
  assert.deepEqual(unexpected.result,{allowed:false,status:503,reason:'ATOMIC_STORE_INVALID_RESULT'});
});
