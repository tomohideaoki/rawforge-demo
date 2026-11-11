/** Offline response validation. No network or AI calls. */
export function validateTranslationResponse(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {ok:false,error:'INVALID_RESPONSE'};
  const {english, japaneseBackTranslation} = value;
  if (typeof english !== 'string' || !english.trim() || [...english].length > 2000) return {ok:false,error:'INVALID_ENGLISH'};
  if (typeof japaneseBackTranslation !== 'string' || !japaneseBackTranslation.trim() || [...japaneseBackTranslation].length > 2000) return {ok:false,error:'BACK_TRANSLATION_MISSING'};
  return {ok:true,english:english.trim(),japaneseBackTranslation:japaneseBackTranslation.trim()};
}
