import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {DatabaseSync} from 'node:sqlite';
import {createBudgetGate} from '../experiments/atomic-budget.mjs';
import {makeSqliteBudgetLedger} from '../experiments/sqlite-budget-ledger.mjs';

function makeStorage({failUserWrite=false}={}) {
  const db=new DatabaseSync(':memory:');
  const state={failUserWrite};
  const sql={
    exec(query,...bindings) {
      const normalized=query.trim().toUpperCase();
      if (normalized.startsWith('CREATE TABLE')) {
        db.exec(query);
        return {toArray:()=>[]};
      }
      if (normalized.startsWith('SELECT')) {
        return {toArray:()=>db.prepare(query).all(...bindings)};
      }
      if (normalized.startsWith('INSERT INTO GP_BUDGET_DAILY_USER') && state.failUserWrite) {
        state.failUserWrite=false;
        throw new Error('synthetic user-table write failure');
      }
      if (normalized.startsWith('INSERT')) {
        db.prepare(query).run(...bindings);
        return {toArray:()=>[]};
      }
      throw new Error('Unexpected SQL in local adapter');
    }
  };
  const storage={
    sql,
    transactionSync(callback) {
      db.exec('BEGIN IMMEDIATE');
      try {
        const result=callback();
        if (result && typeof result.then==='function') throw new TypeError('transactionSync callback must be synchronous');
        db.exec('COMMIT');
        return result;
      } catch (error) {
        db.exec('ROLLBACK');
        throw error;
      }
    }
  };
  return {db,storage,state};
}
const hashUserId=async userId=>createHash('sha256').update('synthetic-test:'+userId).digest('base64url');
const DEFAULTS={
  enabled:true,dailyRequests:20,dailyUnits:100,perUserDailyRequests:4,
  perUserDailyUnits:40,maxUnitsPerRequest:30,
  now:()=>new Date('2026-11-24T09:00:00.000Z')
};
function setup(overrides={}) {
  const local=makeStorage();
  const ledger=makeSqliteBudgetLedger({storage:local.storage,hashUserId});
  const gate=createBudgetGate({reserve:ledger,...DEFAULTS,...overrides});
  return {...local,ledger,gate};
}
const ask=(gate,userId,units)=>gate({userId,units});

test('one reservation increments global and per-user Neuron counters',async()=>{
  const a=setup();
  try {
    assert.deepEqual(await ask(a.gate,'user-a',25),{allowed:true,status:200});
    const g=a.db.prepare('SELECT used_requests,used_neurons FROM gp_budget_daily_global').get();
    const u=a.db.prepare('SELECT used_requests,used_neurons FROM gp_budget_daily_user').get();
    assert.deepEqual({...g},{used_requests:1,used_neurons:25});
    assert.deepEqual({...u},{used_requests:1,used_neurons:25});
  } finally {a.db.close();}
});

test('per-user request cap rejects that user while another user remains eligible',async()=>{
  const a=setup({perUserDailyRequests:2,perUserDailyUnits:60});
  try {
    assert.equal((await ask(a.gate,'user-a',10)).allowed,true);
    assert.equal((await ask(a.gate,'user-a',10)).allowed,true);
    const denied=await ask(a.gate,'user-a',10);
    assert.equal(denied.status,429);
    assert.equal(denied.reason,'LIMIT_EXHAUSTED');
    assert.equal((await ask(a.gate,'user-b',10)).allowed,true);
    assert.equal(a.db.prepare('SELECT used_requests FROM gp_budget_daily_global').get().used_requests,3);
  } finally {a.db.close();}
});

test('per-user Neuron cap applies independently of request count',async()=>{
  const a=setup({perUserDailyRequests:10,perUserDailyUnits:35,maxUnitsPerRequest:30});
  try {
    assert.equal((await ask(a.gate,'user-a',30)).allowed,true);
    assert.equal((await ask(a.gate,'user-a',6)).status,429);
    assert.equal((await ask(a.gate,'user-b',30)).allowed,true);
  } finally {a.db.close();}
});

test('global Neuron cap rejects requests even when request count remains',async()=>{
  const a=setup({dailyRequests:10,dailyUnits:50,perUserDailyRequests:10,perUserDailyUnits:50,maxUnitsPerRequest:30});
  try {
    assert.equal((await ask(a.gate,'user-a',30)).allowed,true);
    assert.equal((await ask(a.gate,'user-b',20)).allowed,true);
    assert.equal((await ask(a.gate,'user-c',1)).status,429);
    assert.equal(a.db.prepare('SELECT used_neurons FROM gp_budget_daily_global').get().used_neurons,50);
  } finally {a.db.close();}
});

test('global request cap rejects additional users',async()=>{
  const a=setup({dailyRequests:3,dailyUnits:100,perUserDailyRequests:3,perUserDailyUnits:100,maxUnitsPerRequest:10});
  try {
    assert.equal((await ask(a.gate,'user-a',1)).allowed,true);
    assert.equal((await ask(a.gate,'user-b',1)).allowed,true);
    assert.equal((await ask(a.gate,'user-c',1)).allowed,true);
    assert.equal((await ask(a.gate,'user-d',1)).status,429);
  } finally {a.db.close();}
});

test('parallel reservations cannot exceed global or per-user caps',async()=>{
  const a=setup({dailyRequests:20,dailyUnits:80,perUserDailyRequests:5,perUserDailyUnits:40,maxUnitsPerRequest:10});
  try {
    const jobs=Array.from({length:60},(_,i)=>ask(a.gate,'user-'+(i%3),10));
    const results=await Promise.all(jobs);
    assert.equal(results.filter(r=>r.allowed).length,8);
    assert.equal(results.filter(r=>r.status===429).length,52);
    const global=a.db.prepare('SELECT used_requests,used_neurons FROM gp_budget_daily_global').get();
    assert.deepEqual({...global},{used_requests:8,used_neurons:80});
    const users=a.db.prepare('SELECT used_requests,used_neurons FROM gp_budget_daily_user').all();
    assert.ok(users.every(u=>u.used_requests<=4 && u.used_neurons<=40));
  } finally {a.db.close();}
});

test('raw user identifier is never stored in quota table',async()=>{
  const a=setup();
  try {
    await ask(a.gate,'synthetic-person-id-123',10);
    const row=a.db.prepare('SELECT user_hash FROM gp_budget_daily_user').get();
    assert.notEqual(row.user_hash,'synthetic-person-id-123');
    assert.match(row.user_hash,/^[A-Za-z0-9_-]{32,128}$/);
  } finally {a.db.close();}
});

test('new UTC day has separate budget rows',async()=>{
  let current='2026-11-24T23:59:00.000Z';
  const a=setup({now:()=>new Date(current),dailyRequests:1,dailyUnits:30,perUserDailyRequests:1,perUserDailyUnits:30,maxUnitsPerRequest:30});
  try {
    assert.equal((await ask(a.gate,'user-a',30)).allowed,true);
    assert.equal((await ask(a.gate,'user-a',1)).status,429);
    current='2026-11-25T00:00:00.000Z';
    assert.equal((await ask(a.gate,'user-a',30)).allowed,true);
    assert.equal(a.db.prepare('SELECT COUNT(*) AS n FROM gp_budget_daily_global').get().n,2);
  } finally {a.db.close();}
});

test('invalid hash rejects before any budget write',async()=>{
  const a=makeStorage();
  try {
    const ledger=makeSqliteBudgetLedger({storage:a.storage,hashUserId:async()=> 'raw-user-id'});
    const gate=createBudgetGate({reserve:ledger,...DEFAULTS});
    assert.equal((await ask(gate,'user-a',5)).status,503);
    assert.equal(a.db.prepare('SELECT COUNT(*) AS n FROM gp_budget_daily_global').get().n,0);
  } finally {a.db.close();}
});

test('transaction rollback leaves no partial global reservation',async()=>{
  const a=makeStorage({failUserWrite:true});
  try {
    const ledger=makeSqliteBudgetLedger({storage:a.storage,hashUserId});
    const gate=createBudgetGate({reserve:ledger,...DEFAULTS});
    const failed=await ask(gate,'user-a',10);
    assert.equal(failed.status,503);
    assert.equal(a.db.prepare('SELECT COUNT(*) AS n FROM gp_budget_daily_global').get().n,0);
    assert.equal(a.db.prepare('SELECT COUNT(*) AS n FROM gp_budget_daily_user').get().n,0);
    assert.equal((await ask(gate,'user-a',10)).allowed,true);
  } finally {a.db.close();}
});

test('limits, request size and account identity fail closed',async()=>{
  const badLimits=setup({perUserDailyRequests:21});
  const badUnits=setup();
  const missingUser=setup();
  try {
    assert.equal((await ask(badLimits.gate,'user-a',1)).reason,'INVALID_LIMITS');
    assert.equal((await ask(badUnits.gate,'user-a',31)).reason,'INVALID_UNITS');
    assert.equal((await ask(missingUser.gate,' ',1)).status,401);
    assert.equal(badLimits.db.prepare('SELECT COUNT(*) AS n FROM gp_budget_daily_global').get().n,0);
  } finally {badLimits.db.close();badUnits.db.close();missingUser.db.close();}
});

test('disabled gate never calls the reservation adapter',async()=>{
  let called=0;
  const gate=createBudgetGate({...DEFAULTS,enabled:false,reserve:async()=>{called++;return true;}});
  assert.equal((await ask(gate,'user-a',1)).status,503);
  assert.equal(called,0);
});
