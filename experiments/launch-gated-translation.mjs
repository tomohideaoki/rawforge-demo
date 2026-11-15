import {createEntitlementGate} from './subscription-entitlement-gate.mjs';
import {createBudgetGate} from './atomic-budget.mjs';
import {validateTranslationResponse} from './translation-response-contract.mjs';
/** Launch-gated offline composition. No API provider or real account/DB adapters.
 * authenticate must return a verified server-side identity, not client JSON.
 * reserveBudget MUST atomically enforce per-user AND global daily ceilings.
 * All counters reserve worst-case units before any model invocation.
 */
export function createLaunchGatedTranslation({authenticate,getEntitlement,reserveBudget,translateBilingual,enabled=false,now=()=>new Date(),dailyRequests=0,dailyUnits=0,maxUnitsPerRequest=0}={}) {
  const entitlement=createEntitlementGate({getEntitlement,reserveUsage:async()=>true,now});
  const budget=createBudgetGate({reserve:reserveBudget,enabled,dailyRequests,dailyUnits,maxUnitsPerRequest,now});
  return async function handle(request) {
    const deny=(status,error)=>({status,body:{error}});
    if(!enabled) return deny(503,'DISABLED');
    if(!request||request.consent!==true) return deny(400,'CONSENT_REQUIRED');
    if(typeof authenticate!=='function'||typeof getEntitlement!=='function'||typeof reserveBudget!=='function'||typeof translateBilingual!=='function') return deny(503,'DEPENDENCY_MISSING');
    let userId;
    try {userId=await authenticate(request)} catch {return deny(401,'AUTH_REQUIRED')}
    const auth=await entitlement({userId,text:request.text});
    if(!auth.allowed) return deny(auth.status,auth.reason);
    const limit=await budget({userId,units:maxUnitsPerRequest});
    if(!limit.allowed) return deny(limit.status,limit.reason);
    try {
      const response=validateTranslationResponse(await translateBilingual(auth.text,{maxOutputTokens:256}));
      if(!response.ok) return deny(502,response.error);
      return {status:200,body:{english:response.english,japaneseBackTranslation:response.japaneseBackTranslation}};
    } catch {return deny(503,'MODEL_UNAVAILABLE')}
  };
}
