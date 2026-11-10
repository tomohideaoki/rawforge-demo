import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createTranslationPipeline} from '../experiments/translation-worker-pipeline.mjs';
import {durableReservation} from '../experiments/translation-durable-adapter.mjs';

// Offline only: serialized transaction mock, NOT a real Durable Object.
function storage() {
  const data = new Map();
  let queue = Promise.resolve();
  return {data, transaction(fn) {
    const p = queue.then(() => fn({get: async k => data.get(k), put: async (k,v) => data.set(k,v)}));
    queue = p.catch(() => {});
    return p;
  }};
}
const opts = {enabled:true,maxDailyRequests:2,maxDailyUnits:14,maxRequestUnits:7,now:()=>new Date('2026-11-10T01:00:00Z')};
const payload = {text:'今日は欠席します。',consent:true};
test('failed model calls still consume reserved budget (no unsafe refund)', async () => {
  const s=storage();
  let called=0;
  const handle=createTranslationPipeline({...opts,reserveBoth:durableReservation(s),translate:async()=>{called++;throw Error('failure')}});
  assert.equal((await handle(payload)).status,503);
  assert.equal((await handle(payload)).status,503);
  assert.equal((await handle(payload)).status,429);
  assert.equal(called,2);
  assert.deepEqual(s.data.get('quota:2026-11-10'),{requests:2,units:14});
});
test('invalid output also consumes reserved budget', async () => {
  const s=storage();
  let called=0;
  const handle=createTranslationPipeline({...opts,reserveBoth:durableReservation(s),translate:async()=>{called++;return ' '}});
  assert.equal((await handle(payload)).status,502);
  assert.equal((await handle(payload)).status,502);
  assert.equal((await handle(payload)).status,429);
  assert.equal(called,2);
});
test('invalid input never reserves quota or calls model', async () => {
  const s=storage();
  let called=0;
  const handle=createTranslationPipeline({...opts,reserveBoth:durableReservation(s),translate:async()=>{called++;return 'ok'}});
  for(const input of [{text:'',consent:true},{text:'hello',consent:false},{text:42,consent:true}]) {
    assert.equal((await handle(input)).status,400);
  }
  assert.equal(called,0);
  assert.equal(s.data.size,0);
});
test('quota-store exception fails closed before model invocation', async () => {
  let called=0;
  const handle=createTranslationPipeline({...opts,reserveBoth:async()=>{throw Error('store offline')},translate:async()=>{called++;return 'ok'}});
  const result=await handle(payload);
  assert.equal(result.status,503);
  assert.equal(called,0);
  assert.ok(!JSON.stringify(result).includes(payload.text));
});
