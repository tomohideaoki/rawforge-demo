/**
 * Global Parents: offline-tested, fail-closed admission gate.
 * Does NOT call AI, deploy, authenticate users, or implement persistent storage.
 * The reserve callback MUST perform an atomic durable increment/check in production.
 */
export async function authorizeTranslation({
  enabled = false,
  maxDailyRequests = 0,
  reserve,
  payload,
  now = new Date(),
} = {}) {
  const deny = (status, reason) => ({ allowed: false, status, reason });
  if (enabled !== true) return deny(503, 'TRANSLATION_DISABLED');
  if (!Number.isSafeInteger(maxDailyRequests) || maxDailyRequests < 1 || maxDailyRequests > 1000) {
    return deny(503, 'QUOTA_NOT_CONFIGURED');
  }
  if (typeof reserve !== 'function') return deny(503, 'ATOMIC_STORE_NOT_CONFIGURED');
  if (!(now instanceof Date) || !Number.isFinite(now.getTime())) return deny(503, 'INVALID_CLOCK');
  // Intentional v2 contract: PR #4 currently sends only {text} and must be adapted before enabling.
  if (!payload || payload.consent !== true) return deny(400, 'CONSENT_REQUIRED');
  if (typeof payload.text !== 'string') return deny(400, 'TEXT_REQUIRED');
  const text = payload.text.trim();
  if (text.length < 1 || Array.from(text).length > 1000) return deny(400, 'INVALID_TEXT_LENGTH');
  // No user data is included in the quota key.
  const utcDay = now.toISOString().slice(0, 10);
  try {
    const result = await reserve({ key: 'gp:translation:' + utcDay, limit: maxDailyRequests });
    if (result === false) return deny(429, 'DAILY_QUOTA_EXHAUSTED');
    if (result !== true) return deny(503, 'ATOMIC_STORE_INVALID_RESULT');
  } catch {
    return deny(503, 'ATOMIC_STORE_UNAVAILABLE');
  }
  return { allowed: true, status: 200, text };
}
