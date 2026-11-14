/** Offline subscription entitlement gate. Server must supply verified account state; never trust client plan fields. */
export function createEntitlementGate({getEntitlement, reserveUsage, now=()=>new Date()}={}) {
  return async function authorize({userId, text}={}) {
    if (typeof userId !== 'string' || !userId.trim()) return {allowed:false,status:401,reason:'AUTH_REQUIRED'};
    if (typeof text !== 'string' || !text.trim() || [...text.trim()].length > 1000) return {allowed:false,status:400,reason:'INVALID_TEXT'};
    if (typeof getEntitlement !== 'function' || typeof reserveUsage !== 'function') return {allowed:false,status:503,reason:'GATE_UNAVAILABLE'};
    try {
      const ent=await getEntitlement(userId);
      if (!ent || ent.plan !== 'premium' || ent.status !== 'active' || !Number.isFinite(Date.parse(ent.periodEnd)) || Date.parse(ent.periodEnd)<=now().getTime()) return {allowed:false,status:403,reason:'PREMIUM_REQUIRED'};
      // Atomic server-side reservation must enforce per-user, global and monetary ceilings.
      const reserved=await reserveUsage({userId,periodEnd:ent.periodEnd});
      if (reserved !== true) return {allowed:false,status:429,reason:'USAGE_LIMIT'};
      return {allowed:true,status:200,text:text.trim()};
    } catch { return {allowed:false,status:503,reason:'GATE_UNAVAILABLE'}; }
  };
}
