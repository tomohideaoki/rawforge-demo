import {authorizeCombined} from './translation-combined-gate.mjs';
/** Offline integration seam. No model client is bundled. Fail closed without explicit dependencies. */
export function createTranslationPipeline({reserveBoth, translate, enabled=false, maxDailyRequests=0, maxDailyUnits=0, maxRequestUnits=0, now=()=>new Date()}={}) {
  return async function handle(payload) {
    if(typeof translate !== 'function') return {status:503,body:{error:'MODEL_NOT_CONFIGURED'}};
    const admission=await authorizeCombined({enabled,payload,reserveBoth,maxDailyRequests,maxDailyUnits,maxRequestUnits,now:now()});
    if(!admission.allowed) return {status:admission.status,body:{error:admission.reason}};
    try {
      const english=await translate(admission.text,{maxOutputTokens:128});
      if(typeof english !== 'string'||!english.trim()||Array.from(english).length>2000) return {status:502,body:{error:'INVALID_MODEL_OUTPUT'}};
      return {status:200,body:{english}};
    } catch { return {status:503,body:{error:'MODEL_UNAVAILABLE'}}; }
  };
}
