import {createPremiumTranslationPipeline} from './premium-translation-pipeline.mjs';
/** Offline HTTP adapter. No deployed routes, providers, credentials or payments. */
export function createTranslationHttpHandler({authenticate,getEntitlement,reserveUsage,translateBilingual,now,enabled=false,allowedOrigin='https://tomohideaoki.github.io'}={}) {
  const run=createPremiumTranslationPipeline({getEntitlement,reserveUsage,translateBilingual,now,enabled});
  return async function handle(request) {
    const headers={'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store','Access-Control-Allow-Origin':allowedOrigin,'Vary':'Origin'};
    const respond=(status,body)=>new Response(JSON.stringify(body),{status,headers});
    const origin=request.headers.get('Origin');
    if(origin && origin!==allowedOrigin) return respond(403,{error:'ORIGIN_NOT_ALLOWED'});
    if(request.method!=='POST') return respond(405,{error:'METHOD_NOT_ALLOWED'});
    if(enabled!==true) return respond(503,{error:'DISABLED'});
    if(typeof authenticate!=='function') return respond(503,{error:'AUTH_NOT_CONFIGURED'});
    let userId;
    try {userId=await authenticate(request)} catch {return respond(401,{error:'AUTH_REQUIRED'})}
    if(typeof userId!=='string'||!userId.trim()) return respond(401,{error:'AUTH_REQUIRED'});
    let payload;
    try {
      if(Number(request.headers.get('Content-Length'))>8192) return respond(413,{error:'BODY_TOO_LARGE'});
      const raw=await request.text();
      if(raw.length>8192) return respond(413,{error:'BODY_TOO_LARGE'});
      payload=JSON.parse(raw);
    } catch {return respond(400,{error:'INVALID_JSON'})}
    if(!payload||typeof payload!=='object'||Array.isArray(payload)) return respond(400,{error:'INVALID_JSON'});
    const result=await run({userId,text:payload.text,consent:payload.consent});
    return respond(result.status,result.body);
  };
}
