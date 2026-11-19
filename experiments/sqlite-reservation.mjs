/** Offline SQLite quota prototype. No AI, network, Worker binding, or deployment.
 * All traffic MUST use one Durable Object instance for a global cap.
 */
const UPSERT = 'INSERT INTO translation_quota (day_key, used) VALUES (?, 1) '
  + 'ON CONFLICT(day_key) DO UPDATE SET used = used + 1 WHERE used < ? RETURNING used';
export function makeSqliteReserve(sql) {
  if (!sql || typeof sql.exec !== 'function') throw new TypeError('SQL storage required');
  sql.exec('CREATE TABLE IF NOT EXISTS translation_quota ('
    + 'day_key TEXT PRIMARY KEY, used INTEGER NOT NULL CHECK (used >= 0))');
  return async ({ key, limit }) => {
    if (typeof key !== 'string' || !/^gp:translation:\d{4}-\d{2}-\d{2}$/.test(key)) {
      throw new TypeError('Invalid quota key');
    }
    if (!Number.isSafeInteger(limit) || limit < 1 || limit > 1000) {
      throw new TypeError('Invalid quota limit');
    }
    const rows = sql.exec(UPSERT, key, limit).toArray();
    if (rows.length > 1) throw new Error('Unexpected quota rows');
    return rows.length === 1;
  };
}
