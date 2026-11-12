/** Offline adapter for the PR #4 response and the bilingual pipeline. */
export function normalizeTranslationResponse(raw, { requireBackTranslation = true } = {}) {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return { ok: false, error: 'INVALID_RESPONSE' };
  const { english, japaneseBackTranslation } = raw;
  if (typeof english !== 'string' || !english.trim() || [...english].length > 2000) return { ok: false, error: 'INVALID_ENGLISH' };
  if (requireBackTranslation && (typeof japaneseBackTranslation !== 'string' || !japaneseBackTranslation.trim() || [...japaneseBackTranslation].length > 2000)) return { ok: false, error: 'BACK_TRANSLATION_MISSING' };
  if (japaneseBackTranslation !== undefined && (typeof japaneseBackTranslation !== 'string' || !japaneseBackTranslation.trim() || [...japaneseBackTranslation].length > 2000)) return { ok: false, error: 'INVALID_BACK_TRANSLATION' };
  return { ok: true, english: english.trim(), japaneseBackTranslation: typeof japaneseBackTranslation === 'string' ? japaneseBackTranslation.trim() : null };
}
