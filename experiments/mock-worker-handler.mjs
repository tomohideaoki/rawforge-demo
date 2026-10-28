/**
 * OFFLINE-ONLY Worker-shaped request handler for Global Parents.
 * Never calls AI, fetch, external services, or production Workers.
 * The successful response is a conspicuous fixture, NOT a translation.
 * Do not deploy this file as a real translation endpoint.
 */
import { authorizeTranslation } from './translation-quota.mjs';

const MAX_BODY_BYTES = 8192;
const MOCK_ENGLISH = '[OFFLINE MOCK ONLY — NOT A TRANSLATION]';
const json = (data, status) => new Response(JSON.stringify(data), {
  status,
  headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' },
});

export function makeOfflineMockHandler({ enabled = false, maxDailyRequests = 0, reserve, now } = {}) {
  return async function handle(request) {
    if (!(request instanceof Request)) return json({ error: 'INVALID_REQUEST' }, 400);
    if (request.method !== 'POST') return json({ error: 'METHOD_NOT_ALLOWED' }, 405);
    if (!/^application\/json(?:\s*;|\s*$)/i.test(request.headers.get('content-type') || '')) {
      return json({ error: 'UNSUPPORTED_MEDIA_TYPE' }, 415);
    }
    // Fail closed before reading a potentially sensitive body if disabled or unconfigured.
    if (enabled !== true) return json({ error: 'TRANSLATION_DISABLED' }, 503);
    if (!Number.isSafeInteger(maxDailyRequests) || maxDailyRequests < 1 || maxDailyRequests > 1000 || typeof reserve !== 'function') {
      return json({ error: 'QUOTA_NOT_CONFIGURED' }, 503);
    }
    const declaredLength = Number(request.headers.get('content-length'));
    if (request.headers.has('content-length') && Number.isFinite(declaredLength) && declaredLength > MAX_BODY_BYTES) {
      return json({ error: 'BODY_TOO_LARGE' }, 413);
    }
    let raw;
    try {
      const reader = request.body?.getReader();
      if (!reader) return json({ error: 'INVALID_BODY' }, 400);
      const decoder = new TextDecoder('utf-8', { fatal: true });
      let size = 0; raw = '';
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        size += value.byteLength;
        if (size > MAX_BODY_BYTES) {
          await reader.cancel();
          return json({ error: 'BODY_TOO_LARGE' }, 413);
        }
        raw += decoder.decode(value, { stream: true });
      }
      raw += decoder.decode();
    } catch {
      return json({ error: 'INVALID_BODY' }, 400);
    }
    let payload;
    try { payload = JSON.parse(raw); } catch { return json({ error: 'INVALID_JSON' }, 400); }
    const decision = await authorizeTranslation({ enabled, maxDailyRequests, reserve, payload, now: now ?? new Date() });
    if (!decision.allowed) return json({ error: decision.reason }, decision.status);
    return json({ english: MOCK_ENGLISH }, 200);
  };
}
