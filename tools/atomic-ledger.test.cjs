'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { AtomicLedger } = require('./atomic-ledger.cjs');
class FakeStorage {
  constructor() { this.data = new Map(); this.queue = Promise.resolve(); }
  transaction(fn) {
    const task = this.queue.then(async () => {
      const copy = new Map(this.data);
      const txn = { get: async k => copy.get(k), put: async (k,v) => { copy.set(k,v); } };
      const result = await fn(txn);
      this.data = copy;
      return result;
    });
    this.queue = task.catch(() => {});
    return task;
  }
}
const input = { day:'2026-10-24', actorId:'test-user', globalLimit:3, actorLimit:2 };
test('no storage fails closed', async () => assert.equal(await new AtomicLedger({}).reserve(input),false));
test('per-user limit', async () => {
  const x=new AtomicLedger(new FakeStorage());
  assert.equal(await x.reserve(input),true);
  assert.equal(await x.reserve(input),true);
  assert.equal(await x.reserve(input),false);
});
test('global limit across actors', async () => {
  const x=new AtomicLedger(new FakeStorage());
  for (const actorId of ['a','b','c'])
    assert.equal(await x.reserve({...input,actorId,actorLimit:5}),true);
  assert.equal(await x.reserve({...input,actorId:'d',actorLimit:5}),false);
});
test('100 concurrent requests obey global limit', async () => {
  const x=new AtomicLedger(new FakeStorage());
  const results=await Promise.all(Array.from({length:100},(_,i)=>
    x.reserve({...input,actorId:'a'+i})));
  assert.equal(results.filter(Boolean).length,3);
});
test('invalid config fails closed', async () => {
  const x=new AtomicLedger(new FakeStorage());
  assert.equal(await x.reserve({...input,actorId:'../bad'}),false);
  assert.equal(await x.reserve({...input,globalLimit:0}),false);
});
test('daily reset', async () => {
  const x=new AtomicLedger(new FakeStorage());
  assert.equal(await x.reserve({...input,globalLimit:1}),true);
  assert.equal(await x.reserve({...input,globalLimit:1}),false);
  assert.equal(await x.reserve({...input,day:'2026-10-25',globalLimit:1}),true);
});
test('transaction error bubbles up to fail-closed outer gate', async () => {
  const x=new AtomicLedger({transaction:async()=>{throw Error('offline');}});
  await assert.rejects(x.reserve(input),/offline/);
});
