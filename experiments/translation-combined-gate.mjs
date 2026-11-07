/** Offline only: reserveBoth must atomically update both durable counters in ONE transaction. No AI calls. */
export async function authorizeCombined({enabled=false,payload,maxDailyRequests=0,maxDailyUnits=0,maxRequestUnits=0,reserveBoth,now=new Date()}={}){
 const deny=(status,reason)=>({allowed:false,status,reason});
 if(enabled!==true)return deny(503,'DISABLED');
 if(!Number.isSafeInteger(maxDailyRequests)||maxDailyRequests<1||maxDailyRequests>1000||!Number.isSafeInteger(maxDailyUnits)||maxDailyUnits<1||maxDailyUnits>1000000||!Number.isSafeInteger(maxRequestUnits)||maxRequestUnits<1||maxRequestUnits>maxDailyUnits)return deny(503,'INVALID_LIMITS');
 if(typeof reserveBoth!=='function')return deny(503,'ATOMIC_COMBINED_STORE_MISSING');
 if(!(now instanceof Date)||!Number.isFinite(now.getTime()))return deny(503,'INVALID_CLOCK');
 if(!payload||payload.consent!==true)return deny(400,'CONSENT_REQUIRED');
 if(typeof payload.text!=='string')return deny(400,'TEXT_REQUIRED');
 const text=payload.text.trim();
 if(!text||Array.from(text).length>1000)return deny(400,'INVALID_TEXT_LENGTH');
 const day=now.toISOString().slice(0,10);
 try{
  const outcome=await reserveBoth({day,requestLimit:maxDailyRequests,unitLimit:maxDailyUnits,units:maxRequestUnits});
  if(outcome===false)return deny(429,'LIMIT_EXHAUSTED');
  if(outcome!==true)return deny(503,'ATOMIC_STORE_INVALID_RESULT');
 }catch{return deny(503,'ATOMIC_STORE_UNAVAILABLE');}
 return {allowed:true,status:200,text,reservedUnits:maxRequestUnits};
}
