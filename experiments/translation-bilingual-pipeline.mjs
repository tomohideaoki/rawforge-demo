import { authorizeCombined } from './translation-combined-gate.mjs';
import { validateTranslationResponse } from './translation-response-contract.mjs';
/** Offline integration: no provider SDK, network calls, or production binding. */
export function createBilingualPipeline({reserveBoth, translateBilingual, enabled=false, maxDailyRequests=0, maxDailyUnits=0, maxRequestUnits=0, now=()=>new Date()}={}) {
  return async function handle(payload) {
    if(typeof translateBilingual !== 'function') return {status:503,body:{error:'MODEL_NOT_CONFIGURED'}};
    const admission=await authorizeCombined({enabled,payload,reserveBoth,maxDailyRequests,maxDailyUnits,maxRequestUnits,now:now()});
    if(!admission.allowed) return {status:admission.status,body:{error:admission.reason}};
    try {
      const raw=await translateBilingual(admission.text,{maxOutputTokens:256});
      const checked=validateTranslationResponse(raw);
      if(!checked.ok) return {status:502,body:{error:checked.error}};
      return {status:200,body:{english:checked.english,japaneseBackTranslation:checked.japaneseBackTranslation}};
    } catch { return {status:503,body:{error:'MODEL_UNAVAILABLE'}}; }
  };
}
