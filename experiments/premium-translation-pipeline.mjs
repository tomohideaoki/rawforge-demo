import { createEntitlementGate } from './subscription-entitlement-gate.mjs';
import { validateTranslationResponse } from './translation-response-contract.mjs';
/** Offline integration only. Caller MUST derive userId from verified server-side session. */
export function createPremiumTranslationPipeline({getEntitlement,reserveUsage,translateBilingual,now,enabled=false}={}) {
  const authorize=createEntitlementGate({getEntitlement,reserveUsage,now});
  return async function handle({userId,text,consent}={}) {
    if(enabled!==true) return {status:503,body:{error:'DISABLED'}};
    if(consent!==true) return {status:400,body:{error:'CONSENT_REQUIRED'}};
    if(typeof translateBilingual!=='function') return {status:503,body:{error:'MODEL_NOT_CONFIGURED'}};
    const a=await authorize({userId,text});
    if(!a.allowed) return {status:a.status,body:{error:a.reason}};
    try {
      const raw=await translateBilingual(a.text,{maxOutputTokens:256});
      const valid=validateTranslationResponse(raw);
      if(!valid.ok) return {status:502,body:{error:valid.error}};
      return {status:200,body:{english:valid.english,japaneseBackTranslation:valid.japaneseBackTranslation}};
    } catch {return {status:503,body:{error:'MODEL_UNAVAILABLE'}};}
  };
}
