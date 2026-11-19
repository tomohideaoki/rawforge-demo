'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { DatabaseSync } = require('node:sqlite');
const reserveModule = import('../experiments/sqlite-reservation.mjs');
const gateModule = import('../experiments/translation-quota.mjs');
function dbAdapter() {
  const db = new DatabaseSync(':memory:');
  const sql = {
    exec(query, ...params) {
      if (params.length) return { toArray: () => db.prepare(query).all(...params) };
      db.exec(query);
      return { toArray: () => [] };
    }
  };
  return { db, sql };
}
test('SQLite UPSERT allows exactly two and denies the third', async () => {
  const { makeSqliteReserve } = await reserveModule;
  const { db, sql } = dbAdapter();
  try {
    const reserve = makeSqliteReserve(sql);
    const key = 'gp:translation:2026-10-27';
    assert.equal(await reserve({ key, limit: 2 }), true);
    assert.equal(await reserve({ key, limit: 2 }), true);
    assert.equal(await reserve({ key, limit: 2 }), false);
    assert.equal(db.prepare('SELECT used FROM translation_quota WHERE day_key = ?').get(key).used, 2);
  } finally { db.close(); }
});
test('parallel calls cannot exceed global quota in one SQLite database', async () => {
  const { makeSqliteReserve } = await reserveModule;
  const { db, sql } = dbAdapter();
  try {
    const reserve = makeSqliteReserve(sql);
    const results = await Promise.all(Array.from({ length: 50 }, () => reserve({ key: 'gp:translation:2026-10-27', limit: 3 })));
    assert.equal(results.filter(Boolean).length, 3);
    assert.equal(db.prepare('SELECT used FROM translation_quota').get().used, 3);
  } finally { db.close(); }
});
test('a second adapter using the same SQLite database sees the same cap', async () => {
  const { makeSqliteReserve } = await reserveModule;
  const { db, sql } = dbAdapter();
  try {
    const a = makeSqliteReserve(sql), b = makeSqliteReserve(sql);
    assert.equal(await a({ key: 'gp:translation:2026-10-27', limit: 1 }), true);
    assert.equal(await b({ key: 'gp:translation:2026-10-27', limit: 1 }), false);
  } finally { db.close(); }
});
test('UTC day key starts a new bucket', async () => {
  const { makeSqliteReserve } = await reserveModule;
  const { db, sql } = dbAdapter();
  try {
    const reserve = makeSqliteReserve(sql);
    assert.equal(await reserve({ key: 'gp:translation:2026-10-26', limit: 1 }), true);
    assert.equal(await reserve({ key: 'gp:translation:2026-10-27', limit: 1 }), true);
  } finally { db.close(); }
});
test('bad key and limit reject without writing rows', async () => {
  const { makeSqliteReserve } = await reserveModule;
  const { db, sql } = dbAdapter();
  try {
    const reserve = makeSqliteReserve(sql);
    await assert.rejects(() => reserve({ key: 'gp:translation:Alice', limit: 2 }), TypeError);
    await assert.rejects(() => reserve({ key: 'gp:translation:2026-10-27', limit: 0 }), TypeError);
    assert.equal(db.prepare('SELECT COUNT(*) AS n FROM translation_quota').get().n, 0);
  } finally { db.close(); }
});
test('gate and real SQLite adapter integrate without AI or network', async () => {
  const { makeSqliteReserve } = await reserveModule;
  const { authorizeTranslation } = await gateModule;
  const { db, sql } = dbAdapter();
  try {
    const args = { enabled: true, maxDailyRequests: 1, reserve: makeSqliteReserve(sql), payload: { text: '欠席します', consent: true }, now: new Date('2026-10-27T00:00:00Z') };
    assert.equal((await authorizeTranslation(args)).allowed, true);
    assert.equal((await authorizeTranslation(args)).reason, 'DAILY_QUOTA_EXHAUSTED');
  } finally { db.close(); }
});
