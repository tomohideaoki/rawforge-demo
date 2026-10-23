'use strict';
/**
 * Pure, offline budget admission gate for a future Global Parents Worker.
 * No AI/API calls, network access, account writes, or deployment.
 * IMPORTANT: A production ledger MUST make global + per-actor reservation
 * atomic across all Worker instances. MemoryLedger is for tests ONLY.
 */
function integerLimit(n) { return Number.isSafeInteger(n) && n > 0; }

async function admitTranslation({ text, actorId, now = new Date(), config, ledger } = {}) {
  // Fail closed until an operator explicitly verifies free-tier ceilings,
  // provider hard spend cap, server authentication and durable ledger.
  if (config?.enabled !== true) return { allowed: false, reason: 'disabled' };
  if (!integerLimit(config.globalDailyLimit) || !integerLimit(config.actorDailyLimit)) {
    return { allowed: false, reason: 'invalid_config' };
  }
  if (typeof text !== 'string' || text.trim().length < 1 || text.trim().length > 1000) {
    return { allowed: false, reason: 'invalid_text' };
  }
  // actorId must be supplied by trusted server-side identity verification,
  // NEVER from an unverified client request field/header.
  if (typeof actorId !== 'string' || !/^[a-zA-Z0-9:_-]{1,100}$/.test(actorId)) {
    return { allowed: false, reason: 'unverified_actor' };
  }
  const date = now instanceof Date ? now : new Date(NaN);
  if (!Number.isFinite(date.getTime())) return { allowed: false, reason: 'invalid_time' };
  if (!ledger || typeof ledger.reserve !== 'function') return { allowed: false, reason: 'missing_atomic_ledger' };
  const day = date.toISOString().slice(0, 10); // UTC day; align with provider accounting.
  try {
    const reserved = await ledger.reserve({ day, actorId, globalLimit: config.globalDailyLimit,
      actorLimit: config.actorDailyLimit });
    if (reserved === true) return { allowed: true, reason: 'reserved', day };
    return { allowed: false, reason: 'quota_exceeded' };
  } catch {
    return { allowed: false, reason: 'ledger_unavailable' };
  }
}

/** Single-process test double; NOT a distributed/production store. */
class MemoryLedger {
  constructor() { this.days = new Map(); }
  async reserve({ day, actorId, globalLimit, actorLimit }) {
    let state = this.days.get(day);
    if (!state) { state = { global: 0, actors: new Map() }; this.days.set(day, state); }
    const current = state.actors.get(actorId) || 0;
    if (state.global >= globalLimit || current >= actorLimit) return false;
    // No await between check and update; atomic only within this JS process.
    state.global++;
    state.actors.set(actorId, current + 1);
    return true;
  }
}
module.exports = { admitTranslation, MemoryLedger };
