import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createLaunchGatedTranslation} from '../experiments/launch-gated-translation.mjs';
const request={text:'欠席します',consent:true};
function setup(overrides={}) {
 const calls={model:0,budget:0};
 const handler=createLaunchGatedTranslation({
  enabled:true,now:()=>new Date('2026-11-17T00:00:00Z'),dailyRequests:10,dailyUnits:1000,maxUnitsPerRequest:100,
  authenticate:async()=> 'verified-id',
  getEntitlement:async()=>({plan:'premium',status:'active',periodEnd:'2026-12-01T00:00:00Z'}),
  reserveBudget:async()=>{calls.budget++;return true},
  translateBilingual:async()=>{calls.model++;return {english:'My child will be absent.',japaneseBackTranslation:'子どもは欠席します。'}},...overrides});
 return {handler,calls};
}
test('success reserves exactly once before AI',async()=>{const x=setup();assert.equal((await x.handler(request)).status,200);assert.deepEqual(x.calls,{model:1,budget:1})});
test('disabled blocks all',async()=>{const x=setup({enabled:false});assert.equal((await x.handler(request)).status,503);assert.equal(x.calls.budget,0)});
test('consent required',async()=>{const x=setup();assert.equal((await x.handler({...request,consent:false})).status,400);assert.equal(x.calls.budget,0)});
test('invalid input blocks reserve',async()=>{const x=setup();assert.equal((await x.handler({...request,text:''})).status,400);assert.equal(x.calls.budget,0)});
test('free user blocks reserve',async()=>{const x=setup({getEntitlement:async()=>({plan:'free',status:'active',periodEnd:'2026-12-01T00:00:00Z'})});assert.equal((await x.handler(request)).status,403);assert.equal(x.calls.budget,0)});
test('unauthenticated blocks reserve',async()=>{const x=setup({authenticate:async()=>null});assert.equal((await x.handler(request)).status,401);assert.equal(x.calls.budget,0)});
test('budget exhausted blocks AI',async()=>{const x=setup({reserveBudget:async()=>false});assert.equal((await x.handler(request)).status,429);assert.equal(x.calls.model,0)});
test('budget store error blocks AI',async()=>{const x=setup({reserveBudget:async()=>{throw Error('offline')}});assert.equal((await x.handler(request)).status,503);assert.equal(x.calls.model,0)});
test('invalid budget limits block AI',async()=>{const x=setup({dailyUnits:0});assert.equal((await x.handler(request)).status,503);assert.equal(x.calls.model,0)});
test('missing adapter blocks AI',async()=>{const x=setup({reserveBudget:null});assert.equal((await x.handler(request)).status,503);assert.equal(x.calls.model,0)});
test('missing back translation fails',async()=>{const x=setup({translateBilingual:async()=>({english:'Absent'})});assert.equal((await x.handler(request)).status,502)});
