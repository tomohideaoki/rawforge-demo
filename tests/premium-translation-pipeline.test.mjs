import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createPremiumTranslationPipeline} from '../experiments/premium-translation-pipeline.mjs';
const active={plan:'premium',status:'active',periodEnd:'2026-12-01T00:00:00Z'};
function make(overrides={}){let reservations=0,calls=0;const handle=createPremiumTranslationPipeline({enabled:true,now:()=>new Date('2026-11-14T00:00:00Z'),getEntitlement:async()=>active,reserveUsage:async()=>{reservations++;return true},translateBilingual:async()=>{calls++;return {english:'My child is absent.',japaneseBackTranslation:'子どもは欠席します。'}},...overrides});return {handle,stats:()=>({reservations,calls})};}
const input={userId:'verified-user',text:'欠席します',consent:true};
test('premium returns both languages after one reservation',async()=>{const a=make();const r=await a.handle(input);assert.equal(r.status,200);assert.equal(r.body.japaneseBackTranslation,'子どもは欠席します。');assert.deepEqual(a.stats(),{reservations:1,calls:1})});
test('disabled rejects without model call',async()=>{const a=make({enabled:false});assert.equal((await a.handle(input)).status,503);assert.equal(a.stats().calls,0)});
test('consent required',async()=>{const a=make();assert.equal((await a.handle({...input,consent:false})).status,400);assert.equal(a.stats().reservations,0)});
test('anonymous rejected',async()=>{const a=make();assert.equal((await a.handle({...input,userId:null})).status,401);assert.equal(a.stats().calls,0)});
test('free plan rejected',async()=>{const a=make({getEntitlement:async()=>({plan:'free'})});assert.equal((await a.handle(input)).status,403);assert.equal(a.stats().reservations,0)});
test('quota rejection blocks model',async()=>{const a=make({reserveUsage:async()=>false});assert.equal((await a.handle(input)).status,429);assert.equal(a.stats().calls,0)});
test('missing back translation rejected',async()=>{const a=make({translateBilingual:async()=>({english:'Hello'})});assert.equal((await a.handle(input)).status,502)});
test('model error does not bypass reservation',async()=>{let n=0;const a=make({reserveUsage:async()=>{n++;return true},translateBilingual:async()=>{throw Error('offline')}});assert.equal((await a.handle(input)).status,503);assert.equal(n,1)});
