/** OFFLINE ONLY. reserve MUST atomically enforce a durable unit counter. Units are a conservative configured upper bound, NOT actual billing. */
export async function authorizeBudget({enabled=false,maxDailyUnits=0,maxRequestUnits=0,reserve,now=new Date()}={}){
 const deny=(status,reason)=>({allowed:false,status,reason});
 if(enabled!==true)return deny(503,'BUDGET_DISABLED');
 if(!Number.isSafeInteger(maxDailyUnits)||maxDailyUnits<1||maxDailyUnits>1000000)return deny(503,'DAILY_BUDGET_INVALID');
 if(!Number.isSafeInteger(maxRequestUnits)||maxRequestUnits<1||maxRequestUnits>maxDailyUnits)return deny(503,'REQUEST_BUDGET_INVALID');
 if(typeof reserve!=='function')return deny(503,'ATOMIC_BUDGET_STORE_MISSING');
 if(!(now instanceof Date)||!Number.isFinite(now.getTime()))return deny(503,'INVALID_CLOCK');
 try{
  const result=await reserve({key:'gp:units:'+now.toISOString().slice(0,10),units:maxRequestUnits,limit:maxDailyUnits});
  if(result===false)return deny(429,'DAILY_BUDGET_EXHAUSTED');
  if(result!==true)return deny(503,'ATOMIC_BUDGET_STORE_INVALID_RESULT');
 }catch{return deny(503,'ATOMIC_BUDGET_STORE_UNAVAILABLE');}
 return {allowed:true,status:200,reservedUnits:maxRequestUnits};
}
