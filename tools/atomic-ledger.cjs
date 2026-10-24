'use strict';
// Prototype only: bind a single Durable Object for the global quota.
// No AI/network call, deployment, or account changes.
class AtomicLedger {
  constructor(storage) { this.storage = storage; }
  async reserve({ day, actorId, globalLimit, actorLimit }) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(day) ||
        !/^[a-zA-Z0-9:_-]{1,100}$/.test(actorId) ||
        !Number.isSafeInteger(globalLimit) || globalLimit < 1 ||
        !Number.isSafeInteger(actorLimit) || actorLimit < 1 ||
        !this.storage || typeof this.storage.transaction !== 'function') return false;
    return this.storage.transaction(async txn => {
      const gKey = 'g:' + day, aKey = 'a:' + day + ':' + actorId;
      const g = (await txn.get(gKey)) ?? 0, a = (await txn.get(aKey)) ?? 0;
      if (!Number.isSafeInteger(g) || !Number.isSafeInteger(a) ||
          g < 0 || a < 0 || g >= globalLimit || a >= actorLimit) return false;
      await txn.put(gKey, g + 1);
      await txn.put(aKey, a + 1);
      return true;
    });
  }
}
module.exports = { AtomicLedger };
