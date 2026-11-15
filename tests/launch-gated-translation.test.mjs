import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createLaunchGatedTranslation} from '../experiments/launch-gated-translation.mjs';
const premium={plan:'premium',status:'active',periodEnd:'2026-12-01T00:00:00Z'};
function setup(overrides={}) {
  const calls={model:0,budget:0};
  const handler=createLaunchGatedTranslation({
    enabled:true,now:()=>new Date('2026-11-15T00:00:00Z'),dailyRequests:10,dailyUnits:1000,maxUnitsPerRequest:100,
    authenticate:async()=> 'server-user',getEntitlement:async()=>premium,
    reserveBudget:async()=>{calls.budget++;return true},
    translateBilingual:async()=>{calls.model++;return {english:'My child is absent.',japaneseBackTranslation:'子どもは欠席します。'}},...overrides
  });
  return {handler,calls};
}
const req={text:'欠席します',consent:true};
test('success after budget reservation',async()=>{const a=setup();assert.equal((await a.handler(req)).status,200);assert.deepEqual(a.calls,{model:1,budget:1})});
test('disabled: no model',async()=>{const a=setup({enabled:false});assert.equal((await a.handler(req)).status,503);assert.equal(a.calls.model,0)});
test('no consent: no reservation',async()=>{const a=setup();assert.equal((await a.handler({...req,consent:false})).status,400);assert.equal(a.calls.budget,0)});
test('free account: no reservation',async()=>{const a=setup({getEntitlement:async()=>({plan:'free'})});assert.equal((await a.handler(req)).status,403);assert.equal(a.calls.budget,0)});
test('missing identity: no reservation',async()=>{const a=setup({authenticate:async()=>null});assert.equal((await a.handler(req)).status,401);assert.equal(a.calls.budget,0)});
test('limit exhausted: no model',async()=>{const a=setup({reserveBudget:async()=>false});assert.equal((await a.handler(req)).status,429);assert.equal(a.calls.model,0)});
test('store error: no model',async()=>{const a=setup({reserveBudget:async()=>{throw Error('offline')}});assert.equal((await a.handler(req)).status,503);assert.equal(a.calls.model,0)});
test('invalid budget config: no model',async()=>{const a=setup({dailyUnits:0});assert.equal((await a.handler(req)).status,503);assert.equal(a.calls.model,0)});
test('missing bilingual response rejected',async()=>{const a=setup({translateBilingual:async()=>({english:'Hello'})});assert.equal((await a.handler(req)).status,502)});
test('missing adapter fails closed',async()=>{const a=setup({authenticate:null});assert.equal((await a.handler(req)).status,503);assert.equal(a.calls.model,0)});
