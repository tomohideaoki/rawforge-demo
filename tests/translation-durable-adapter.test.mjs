import {test} from 'node:test';
import assert from 'node:assert/strict';
import {durableReservation} from '../experiments/translation-durable-adapter.mjs';
import {authorizeCombined} from '../experiments/translation-combined-gate.mjs';
function fakeStorage(){const data=new Map();let tail=Promise.resolve();return {data,transaction(fn){const p=tail.then(()=>fn({get:async k=>data.get(k),put:async(k,v)=>{data.set(k,v)}}));tail=p.catch(()=>{});return p}}}
const base={enabled:true,payload:{text:'欠席します',consent:true},maxDailyRequests:5,maxDailyUnits:21,maxRequestUnits:7,now:new Date('2026-11-08T00:00:00Z')};
test('100 simultaneous requests admit only 3',async()=>{const s=fakeStorage(),reserveBoth=durableReservation(s);const r=await Promise.all(Array.from({length:100},()=>authorizeCombined({...base,reserveBoth})));assert.equal(r.filter(x=>x.allowed).length,3);assert.deepEqual(s.data.get('quota:2026-11-08'),{requests:3,units:21})});
test('request limit independently caps admissions',async()=>{const reserveBoth=durableReservation(fakeStorage());const r=await Promise.all(Array.from({length:10},()=>authorizeCombined({...base,maxDailyRequests:2,maxDailyUnits:100,reserveBoth})));assert.equal(r.filter(x=>x.allowed).length,2)});
test('UTC dates use separate counters',async()=>{const s=fakeStorage(),reserveBoth=durableReservation(s);for(const day of ['2026-11-08','2026-11-09'])assert.equal((await authorizeCombined({...base,maxDailyRequests:1,now:new Date(day+'T00:00:00Z'),reserveBoth})).allowed,true);assert.equal(s.data.size,2)});
test('missing transactions and storage failures fail closed',async()=>{assert.throws(()=>durableReservation({get(){},put(){}}),/transactional/);assert.equal((await authorizeCombined({...base,reserveBoth:async()=>{throw Error('down')}})).status,503)});
test('corrupt state is not overwritten',async()=>{const s=fakeStorage();s.data.set('quota:2026-11-08',{requests:-1,units:0});assert.equal((await authorizeCombined({...base,reserveBoth:durableReservation(s)})).status,503);assert.equal(s.data.get('quota:2026-11-08').requests,-1)});
test('invalid input does not consume quota',async()=>{const s=fakeStorage();for(const payload of [{text:'x',consent:false},{text:' ',consent:true}])assert.equal((await authorizeCombined({...base,payload,reserveBoth:durableReservation(s)})).allowed,false);assert.equal(s.data.size,0)});
