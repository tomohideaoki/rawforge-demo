import {test} from 'node:test';
import assert from 'node:assert/strict';
import {authorizeCombined} from '../experiments/translation-combined-gate.mjs';
const base={enabled:true,payload:{text:'明日は欠席します',consent:true},maxDailyRequests:5,maxDailyUnits:21,maxRequestUnits:7,now:new Date('2026-11-07T12:00:00Z')};
test('100 concurrent requests honor both limits atomically',async()=>{
 let requests=0,units=0;const reserveBoth=async({requestLimit,unitLimit,units:u})=>{if(requests+1>requestLimit||units+u>unitLimit)return false;requests++;units+=u;return true};
 const results=await Promise.all(Array.from({length:100},()=>authorizeCombined({...base,reserveBoth})));
 assert.equal(results.filter(r=>r.allowed).length,3);assert.equal(requests,3);assert.equal(units,21);
});
test('request limit wins even if unit budget remains',async()=>{
 let requests=0;const reserveBoth=async({requestLimit})=>requests<requestLimit?(requests++,true):false;
 const results=await Promise.all(Array.from({length:9},()=>authorizeCombined({...base,maxDailyRequests:2,maxDailyUnits:100,reserveBoth})));
 assert.equal(results.filter(r=>r.allowed).length,2);
});
test('invalid input and missing consent never reserve',async()=>{
 let calls=0;const reserveBoth=async()=>{calls++;return true};
 for(const payload of [{text:'x'}, {text:' ',consent:true},{text:'a'.repeat(1001),consent:true},{text:1,consent:true}])assert.equal((await authorizeCombined({...base,payload,reserveBoth})).allowed,false);
 assert.equal(calls,0);
});
test('missing storage, bad settings, exceptions and nonboolean response fail closed',async()=>{
 for(const options of [{reserveBoth:null},{maxDailyRequests:0},{maxDailyUnits:0},{maxRequestUnits:22},{reserveBoth:async()=>{throw Error('down')}},{reserveBoth:async()=>1}]){
 const r=await authorizeCombined({...base,reserveBoth:async()=>true,...options});assert.equal(r.allowed,false);assert.equal(r.status,503);
 }
});
test('reservation contains only day and limits, no input text',async()=>{
 let args;await authorizeCombined({...base,reserveBoth:async x=>(args=x,true)});
 assert.deepEqual(args,{day:'2026-11-07',requestLimit:5,unitLimit:21,units:7});
});
