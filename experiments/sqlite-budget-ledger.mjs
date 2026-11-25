/**
 * Offline-testable SQLite budget ledger for a SQLite-backed Durable Object.
 *
 * - Stores daily global and per-user request/Neuron reservations atomically.
 * - Stores only a server-generated HMAC-style user digest, never the raw user ID.
 * - Requires storage.transactionSync(); no async work occurs inside the transaction.
 * - No Worker binding, authentication provider, AI call, network, or deployment is included.
 *
 * Production requirements:
 *   hashUserId must be a server-only HMAC (key from secret storage), not a client-supplied hash.
 *   Route ALL traffic through one stable global budget Durable Object ID.
 *   Compute "units" as a conservative maximum Neuron reservation for the fixed model,
 *   including prompt/input and max output tokens. If that cannot be estimated, deny.
 *   Deletion is metered as SQLite row writes; include retention cleanup in the write budget.
 */
const GLOBAL_TABLE = 'gp_budget_daily_global';
const USER_TABLE = 'gp_budget_daily_user';
const CLEANUP_TABLE = 'gp_budget_cleanup_state';
const HASH_PATTERN = /^[A-Za-z0-9_-]{32,128}$/;
const DAY_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

function validDay(day) {
  if (typeof day !== 'string' || !DAY_PATTERN.test(day)) return false;
  const d = new Date(day + 'T00:00:00.000Z');
  return Number.isFinite(d.getTime()) && d.toISOString().slice(0,10) === day;
}
function validPositiveInt(value) {
  return Number.isSafeInteger(value) && value > 0;
}
function dayBefore(day, days) {
  const date = new Date(day + 'T00:00:00.000Z');
  date.setUTCDate(date.getUTCDate() - days);
  return date.toISOString().slice(0, 10);
}

export function makeSqliteBudgetLedger({storage,hashUserId,retentionDays=1}={}) {
  if (!storage || typeof storage.transactionSync !== 'function' ||
      !storage.sql || typeof storage.sql.exec !== 'function') {
    throw new TypeError('SQLite-backed Durable Object storage with transactionSync is required');
  }
  if (typeof hashUserId !== 'function') {
    throw new TypeError('A server-only user ID HMAC function is required');
  }
  if (!Number.isSafeInteger(retentionDays) || retentionDays < 1 || retentionDays > 30) {
    throw new TypeError('retentionDays must be an integer from 1 to 30');
  }

  storage.sql.exec(`
    CREATE TABLE IF NOT EXISTS ${GLOBAL_TABLE} (
      day TEXT PRIMARY KEY,
      used_requests INTEGER NOT NULL CHECK (used_requests >= 0),
      used_neurons INTEGER NOT NULL CHECK (used_neurons >= 0)
    )
  `);
  storage.sql.exec(`
    CREATE TABLE IF NOT EXISTS ${USER_TABLE} (
      day TEXT NOT NULL,
      user_hash TEXT NOT NULL,
      used_requests INTEGER NOT NULL CHECK (used_requests >= 0),
      used_neurons INTEGER NOT NULL CHECK (used_neurons >= 0),
      PRIMARY KEY (day, user_hash)
    )
  `);
  storage.sql.exec(`
    CREATE TABLE IF NOT EXISTS ${CLEANUP_TABLE} (
      singleton INTEGER PRIMARY KEY CHECK (singleton = 1),
      last_cleaned_day TEXT NOT NULL
    )
  `);

  return async function reserve({
    userId,day,units,dailyRequests,dailyUnits,
    perUserDailyRequests,perUserDailyUnits,maxUnitsPerRequest
  }={}) {
    if (typeof userId !== 'string' || !userId.trim()) throw new TypeError('Verified user ID required');
    if (!validDay(day)) throw new TypeError('UTC day key must be YYYY-MM-DD');
    if (![units,dailyRequests,dailyUnits,perUserDailyRequests,perUserDailyUnits,maxUnitsPerRequest].every(validPositiveInt) ||
        perUserDailyRequests > dailyRequests ||
        perUserDailyUnits > dailyUnits ||
        maxUnitsPerRequest > dailyUnits ||
        maxUnitsPerRequest > perUserDailyUnits ||
        units > maxUnitsPerRequest) {
      throw new TypeError('Invalid request or daily Neuron limits');
    }

    // Hash before entering the synchronous transaction. Never put raw user IDs in quota rows.
    const userHash = await hashUserId(userId);
    if (typeof userHash !== 'string' || !HASH_PATTERN.test(userHash)) {
      throw new TypeError('hashUserId must return a 32-128 character base64url digest');
    }

    // Cleanup and reserve are atomic for all callers routed to the same DO.
    // Keep one UTC day by default; only pseudonymous quota counts are retained.
    // The DELETE statements count as SQLite rows written on Cloudflare.
    return storage.transactionSync(() => {
      const cleanupRows = storage.sql.exec(
        `SELECT last_cleaned_day FROM ${CLEANUP_TABLE} WHERE singleton = 1`
      ).toArray();
      const lastCleanedDay = cleanupRows[0]?.last_cleaned_day;
      if (!lastCleanedDay || lastCleanedDay < day) {
        const cutoff = dayBefore(day, retentionDays - 1);
        storage.sql.exec(`DELETE FROM ${GLOBAL_TABLE} WHERE day < ?`, cutoff);
        storage.sql.exec(`DELETE FROM ${USER_TABLE} WHERE day < ?`, cutoff);
        storage.sql.exec(
          `INSERT INTO ${CLEANUP_TABLE} (singleton, last_cleaned_day) VALUES (1, ?)
           ON CONFLICT(singleton) DO UPDATE SET last_cleaned_day = excluded.last_cleaned_day`,
          day
        );
      }

      const globalRows = storage.sql.exec(
        `SELECT used_requests, used_neurons FROM ${GLOBAL_TABLE} WHERE day = ?`, day
      ).toArray();
      const userRows = storage.sql.exec(
        `SELECT used_requests, used_neurons FROM ${USER_TABLE} WHERE day = ? AND user_hash = ?`,
        day,userHash
      ).toArray();
      const global = globalRows[0] || {used_requests:0,used_neurons:0};
      const user = userRows[0] || {used_requests:0,used_neurons:0};

      if (global.used_requests + 1 > dailyRequests ||
          global.used_neurons + units > dailyUnits ||
          user.used_requests + 1 > perUserDailyRequests ||
          user.used_neurons + units > perUserDailyUnits) return false;

      storage.sql.exec(
        `INSERT INTO ${GLOBAL_TABLE} (day, used_requests, used_neurons)
         VALUES (?, 1, ?)
         ON CONFLICT(day) DO UPDATE SET
           used_requests = used_requests + 1,
           used_neurons = used_neurons + excluded.used_neurons`,
        day,units
      );
      storage.sql.exec(
        `INSERT INTO ${USER_TABLE} (day, user_hash, used_requests, used_neurons)
         VALUES (?, ?, 1, ?)
         ON CONFLICT(day, user_hash) DO UPDATE SET
           used_requests = used_requests + 1,
           used_neurons = used_neurons + excluded.used_neurons`,
        day,userHash,units
      );
      return true;
    });
  };
}
