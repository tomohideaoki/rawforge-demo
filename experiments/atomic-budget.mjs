/** Offline adapter: reserve must be a single atomic transaction in production. */
export function createBudgetGate({reserve, enabled=false, dailyRequests=0, dailyUnits=0, maxUnitsPerRequest=0, now=()=>new Date()}={}) {
  return async function authorize({userId, units}={}) {
    if (!enabled || typeof reserve !== 'function') return {allowed:false,status:503,reason:'DISABLED'};
    if (![dailyRequests,dailyUnits,maxUnitsPerRequest].every(Number.isSafeInteger) || dailyRequests<1 || dailyUnits<1 || maxUnitsPerRequest<1 || maxUnitsPerRequest>dailyUnits) return {allowed:false,status:503,reason:'INVALID_LIMITS'};
    if (typeof userId !== 'string' || !userId.trim()) return {allowed:false,status:401,reason:'AUTH_REQUIRED'};
    if (!Number.isSafeInteger(units) || units<1 || units>maxUnitsPerRequest) return {allowed:false,status:400,reason:'INVALID_UNITS'};
    const date=now();
    if (!(date instanceof Date) || !Number.isFinite(date.getTime())) return {allowed:false,status:503,reason:'INVALID_CLOCK'};
    try {
      const accepted=await reserve({userId,day:date.toISOString().slice(0,10),units,dailyRequests,dailyUnits});
      if (accepted===true) return {allowed:true,status:200};
      if (accepted===false) return {allowed:false,status:429,reason:'LIMIT_EXHAUSTED'};
      return {allowed:false,status:503,reason:'INVALID_STORE_RESULT'};
    } catch {return {allowed:false,status:503,reason:'STORE_UNAVAILABLE'};}
  };
}
