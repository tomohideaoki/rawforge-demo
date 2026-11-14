import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createTranslationHttpHandler} from '../experiments/translation-http-handler.mjs';
const ent={plan:'premium',status:'active',periodEnd:'2026-12-01T00:00:00Z'};
function make(opts={}){let modelCalls=0;const handler=createTranslationHttpHandler({enabled:true,authenticate:async()=> 'verified-user',getEntitlement:async()=>ent,reserveUsage:async()=>true,now:()=>new Date('2026-11-14T00:00:00Z'),translateBilingual:async()=>{modelCalls++;return {english:'My child will be absent.',japaneseBackTranslation:'子どもは欠席します。'}},...opts});return {handler,modelCalls:()=>modelCalls}}
const req=(data={text:'欠席します',consent:true},method='POST',origin='https://tomohideaoki.github.io')=>new Request('https://example.invalid/translate',{method,headers:{'Content-Type':'application/json','Origin':origin},body:method==='POST'?JSON.stringify(data):undefined});
test('valid request returns bilingual response',async()=>{const a=make();const r=await a.handler(req());assert.equal(r.status,200);assert.equal((await r.json()).japaneseBackTranslation,'子どもは欠席します。');assert.equal(a.modelCalls(),1)});
test('feature disabled fails closed',async()=>{const a=make({enabled:false});assert.equal((await a.handler(req())).status,503);assert.equal(a.modelCalls(),0)});
test('cross origin denied',async()=>{const a=make();assert.equal((await a.handler(req(undefined,'POST','https://evil.invalid'))).status,403);assert.equal(a.modelCalls(),0)});
test('unauthenticated denied',async()=>{const a=make({authenticate:async()=>null});assert.equal((await a.handler(req())).status,401);assert.equal(a.modelCalls(),0)});
test('free plan denied',async()=>{const a=make({getEntitlement:async()=>({plan:'free'})});assert.equal((await a.handler(req())).status,403);assert.equal(a.modelCalls(),0)});
test('usage ceiling denied',async()=>{const a=make({reserveUsage:async()=>false});assert.equal((await a.handler(req())).status,429);assert.equal(a.modelCalls(),0)});
test('consent required',async()=>{const a=make();assert.equal((await a.handler(req({text:'欠席',consent:false}))).status,400);assert.equal(a.modelCalls(),0)});
test('get rejected',async()=>{const a=make();assert.equal((await a.handler(req(undefined,'GET'))).status,405)});
test('missing authentication adapter',async()=>{const a=make({authenticate:null});assert.equal((await a.handler(req())).status,503)});
