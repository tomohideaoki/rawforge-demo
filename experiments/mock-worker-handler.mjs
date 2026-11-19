/**
 * OFFLINE-ONLY Worker-shaped request handler for Global Parents.
 * Never calls AI, fetch, external services, or production Workers.
 * The successful response is a conspicuous fixture, NOT a translation.
 * Do not deploy this file as a real translation endpoint.
 * CORS is browser access control, NOT authentication or abuse/cost protection.
 */
import { authorizeTranslation } from './translation-quota.mjs';

const MAX_BODY_BYTES = 8192;
const MOCK_ENGLISH = '[OFFLINE MOCK ONLY — NOT A TRANSLATION]';
const DEFAULT_ALLOWED_ORIGIN = 'https://tomohideaoki.github.io';
const corsHeaders = origin => ({
  'Cache-Control': 'no-store',
  'Vary': 'Origin',
  ...(origin ? { 'Access-Control-Allow-Origin': origin } : {}),
});
const json = (data, status, origin) => new Response(JSON.stringify(data), {
  status,
  headers: { 'Content-Type': 'application/json; charset=utf-8', ...corsHeaders(origin) },
});

export function makeOfflineMockHandler({ enabled = false, maxDailyRequests = 0, reserve, now, allowedOrigin = DEFAULT_ALLOWED_ORIGIN } = {}) {
  return async function handle(request) {
    if (!(request instanceof Request)) return json({ error: 'INVALID_REQUEST' }, 400);
    const origin = request.headers.get('origin');
    // An unknown browser Origin never gets a CORS permission header or a quota reservation.
    if (origin !== null && origin !== allowedOrigin) return json({ error: 'ORIGIN_NOT_ALLOWED' }, 403);
    if (request.method === 'OPTIONS') {
      const method = request.headers.get('access-control-request-method');
      const requested = (request.headers.get('access-control-request-headers') || '')
        .split(',').map(h => h.trim().toLowerCase()).filter(Boolean);
      if (origin === null || method !== 'POST' || requested.some(h => h !== 'content-type')) {
        return json({ error: 'PREFLIGHT_NOT_ALLOWED' }, 403, origin);
      }
      return new Response(null, {
        status: 204,
        headers: {
          ...corsHeaders(origin),
          'Access-Control-Allow-Methods': 'POST',
          'Access-Control-Allow-Headers': 'Content-Type',
          'Access-Control-Max-Age': '0',
        },
      });
    }
    const respond = (data, status) => json(data, status, origin);
    if (request.method !== 'POST') return respond({ error: 'METHOD_NOT_ALLOWED' }, 405);
    if (!/^application\/json(?:\s*;|\s*$)/i.test(request.headers.get('content-type') || '')) {
      return respond({ error: 'UNSUPPORTED_MEDIA_TYPE' }, 415);
    }
    // Fail closed before reading a potentially sensitive body if disabled or unconfigured.
    if (enabled !== true) return respond({ error: 'TRANSLATION_DISABLED' }, 503);
    if (!Number.isSafeInteger(maxDailyRequests) || maxDailyRequests < 1 || maxDailyRequests > 1000 || typeof reserve !== 'function') {
      return respond({ error: 'QUOTA_NOT_CONFIGURED' }, 503);
    }
    const declaredLength = Number(request.headers.get('content-length'));
    if (request.headers.has('content-length') && Number.isFinite(declaredLength) && declaredLength > MAX_BODY_BYTES) {
      return respond({ error: 'BODY_TOO_LARGE' }, 413);
    }
    let raw;
    try {
      const reader = request.body?.getReader();
      if (!reader) return respond({ error: 'INVALID_BODY' }, 400);
      const decoder = new TextDecoder('utf-8', { fatal: true });
      let size = 0; raw = '';
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        size += value.byteLength;
        if (size > MAX_BODY_BYTES) {
          await reader.cancel();
          return respond({ error: 'BODY_TOO_LARGE' }, 413);
        }
        raw += decoder.decode(value, { stream: true });
      }
      raw += decoder.decode();
    } catch {
      return respond({ error: 'INVALID_BODY' }, 400);
    }
    let payload;
    try { payload = JSON.parse(raw); } catch { return respond({ error: 'INVALID_JSON' }, 400); }
    const decision = await authorizeTranslation({ enabled, maxDailyRequests, reserve, payload, now: now ?? new Date() });
    if (!decision.allowed) return respond({ error: decision.reason }, decision.status);
    return respond({ english: MOCK_ENGLISH }, 200);
  };
}
