import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createLaunchGatedTranslation} from '../experiments/launch-gated-translation.mjs';
const req={text:'今日は家族の予定があるため、学校を欠席します。',consent:true};
const valid={english:'My child will be absent from school today due to a family commitment.',japaneseBackTranslation:'子どもは今日、家族の予定のため学校を欠席します。'};
function fixture(overrides={}){
 const calls={auth:0,ent:0,reserve:0,model:0};
 const handle=createLaunchGatedTranslation({
 enabled:true,now:()=>new Date('2026-11-19T00:00:00Z'),dailyRequests:5,dailyUnits:1000,maxUnitsPerRequest:100,
 authenticate:async()=>{calls.auth++;return 'verified-user'},
 getEntitlement:async()=>{calls.ent++;return {plan:'premium',status:'active',periodEnd:'2026-12-01T00:00:00Z'}},
 reserveBudget:async()=>{calls.reserve++;return true},
 translateBilingual:async()=>{calls.model++;return valid},...overrides});
 return {handle,calls};
}
test('premium user gets bilingual response after reservation',async()=>{const x=fixture();const r=await x.handle(req);assert.equal(r.status,200);assert.deepEqual(r.body,valid);assert.deepEqual(x.calls,{auth:1,ent:1,reserve:1,model:1})});
test('disabled never authenticates or calls model',async()=>{const x=fixture({enabled:false});assert.equal((await x.handle(req)).status,503);assert.equal(x.calls.auth,0)});
test('consent required before authentication',async()=>{const x=fixture();assert.equal((await x.handle({...req,consent:false})).status,400);assert.equal(x.calls.auth,0)});
test('anonymous blocked',async()=>{const x=fixture({authenticate:async()=>null});assert.equal((await x.handle(req)).status,401);assert.equal(x.calls.reserve,0)});
test('inactive subscription blocked',async()=>{const x=fixture({getEntitlement:async()=>({plan:'premium',status:'canceled',periodEnd:'2026-12-01'})});assert.equal((await x.handle(req)).status,403);assert.equal(x.calls.reserve,0)});
test('expired subscription blocked',async()=>{const x=fixture({getEntitlement:async()=>({plan:'premium',status:'active',periodEnd:'2026-11-18'})});assert.equal((await x.handle(req)).status,403);assert.equal(x.calls.model,0)});
test('invalid input blocked before budget',async()=>{const x=fixture();assert.equal((await x.handle({...req,text:' '})).status,400);assert.equal(x.calls.reserve,0)});
test('limit exceeded never calls AI',async()=>{const x=fixture({reserveBudget:async()=>false});assert.equal((await x.handle(req)).status,429);assert.equal(x.calls.model,0)});
test('budget database failure never calls AI',async()=>{const x=fixture({reserveBudget:async()=>{throw Error('db down')}});assert.equal((await x.handle(req)).status,503);assert.equal(x.calls.model,0)});
test('invalid limits never call AI',async()=>{const x=fixture({dailyUnits:0});assert.equal((await x.handle(req)).status,503);assert.equal(x.calls.model,0)});
test('model failure does not pretend success',async()=>{const x=fixture({translateBilingual:async()=>{throw Error('offline')}});assert.equal((await x.handle(req)).status,503)});
test('english only result rejected',async()=>{const x=fixture({translateBilingual:async()=>({english:'Hello'})});assert.equal((await x.handle(req)).status,502)});
test('client supplied premium plan is ignored',async()=>{const x=fixture({getEntitlement:async()=>({plan:'free',status:'active',periodEnd:'2026-12-01'})});assert.equal((await x.handle({...req,plan:'premium',userId:'fake'})).status,403);assert.equal(x.calls.model,0)});
