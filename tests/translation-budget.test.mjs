import {test} from 'node:test';
import assert from 'node:assert/strict';
import {authorizeBudget} from '../experiments/translation-budget.mjs';
const defaults={enabled:true,maxDailyUnits:21,maxRequestUnits:7,now:new Date('2026-11-06T12:00:00Z')};
test('invalid config and missing store fail closed',async()=>{
 let calls=0;const reserve=async()=>{calls++;return true};
 for(const override of [{enabled:false},{maxDailyUnits:0},{maxDailyUnits:1.2},{maxRequestUnits:22},{maxRequestUnits:0},{reserve:null},{now:new Date('invalid')}]){
  assert.equal((await authorizeBudget({...defaults,reserve,...override})).allowed,false);
 }assert.equal(calls,0);
});
test('100 concurrent requests with atomic store reserve at most 21 units',async()=>{
 let used=0;const reserve=async({units,limit})=>{if(used+units>limit)return false;used+=units;return true};
 const results=await Promise.all(Array.from({length:100},()=>authorizeBudget({...defaults,reserve})));
 assert.equal(results.filter(x=>x.allowed).length,3);assert.equal(results.filter(x=>x.status===429).length,97);assert.equal(used,21);
});
test('reservation key and units contain no personal information',async()=>{
 let args;const result=await authorizeBudget({...defaults,reserve:async x=>(args=x,true)});
 assert.equal(result.allowed,true);assert.deepEqual(args,{key:'gp:units:2026-11-06',units:7,limit:21});
});
test('store errors and nonboolean values fail closed',async()=>{
 for(const reserve of [async()=>{throw Error('down')},async()=>undefined,async()=>1]){
  const result=await authorizeBudget({...defaults,reserve});assert.equal(result.status,503);assert.equal(result.allowed,false);
 }
});
test('non-atomic read-modify-write allows oversubscription and is forbidden',async()=>{
 let used=0;const reserve=async({units,limit})=>{const snapshot=used;await Promise.resolve();if(snapshot+units>limit)return false;used=snapshot+units;return true};
 const results=await Promise.all(Array.from({length:100},()=>authorizeBudget({...defaults,reserve})));
 assert.equal(results.filter(x=>x.allowed).length,100);
});
