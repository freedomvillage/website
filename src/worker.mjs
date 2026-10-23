import {nightWindow} from './seoul-night.mjs';
import {DIAGNOSTIC_KEY,diagnostic,xmlCode,boundedBody,payloadCategory} from './air-diagnostics.mjs';
import {handleCatalogRequest,handleMediaRequest} from './content/catalog.mjs';
import {handleJevCheck} from './content/check.mjs';
import {handleRankingEvaluation} from './content/evaluation.mjs';
import {handleContentPage} from './content/pages.mjs';
import {handleStudyRequest} from './content/studies.mjs';
// Provider schema remains fixture-tested until an authorized real response is verified.
const SOURCE='https://www.airkorea.or.kr/';
const ENDPOINT='https://apis.data.go.kr/B552584/ArpltnInforInqireSvc/getMsrstnAcctoRltmMesureDnsty';
export const MAX_AGE_MS=60*60*1000;
export const CACHE_KEY='air-quality:latest:v1';
export const SLOT_KEY='air-quality:attempt-slot:v1';
const SLOT_MS=15*60*1000;
export function normalizeAir(payload, station, now = Date.now()) {
  if (String(payload?.response?.header?.resultCode) !== '00') throw new Error('Invalid provider result');
  const row = payload?.response?.body?.items?.[0];
  if (!row || (row.stationName && row.stationName !== station)) throw new Error('Missing station');
  const raw = String(row.pm25Value ?? '').trim();
  if (!/^\d+(?:\.\d+)?$/.test(raw) || (row.pm25Flag != null && String(row.pm25Flag).trim() !== '')) throw new Error('Invalid reading');
  const pm25 = Number(raw);
  if (!Number.isFinite(pm25) || pm25 > 1000) throw new Error('Out of range');
  const timestamp = String(row.dataTime ?? '');
  if (!/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}$/.test(timestamp)) throw new Error('Invalid time');
  const date = new Date(timestamp.replace(' ', 'T') + ':00+09:00');
  const observed = date.getTime();
  if (!Number.isFinite(observed) || new Date(observed + 9 * 60 * 60 * 1000).toISOString().slice(0,16).replace('T',' ') !== timestamp || observed > now + 5 * 60 * 1000) throw new Error('Invalid time');
  const status = now - observed > MAX_AGE_MS ? 'stale' : 'ok';
  return {status, pm25, unit:'µg/m³', station, observedAt:date.toISOString(), source:SOURCE,
    attribution:'AirKorea / Korea Environment Corporation', kind:'station observation',
    note:'Local station measurement; not actual N Seoul Tower lighting status.'};
}
function unknown(reason,station){return {status:'unknown',pm25:null,observedAt:null,validUntil:null,unit:'µg/m³',station:station||null,source:SOURCE,reason};}
function json(body,status=200){return new Response(JSON.stringify(body),{status,headers:{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store','X-Content-Type-Options':'nosniff','X-Robots-Tag':'noindex'}});}
export function publicReading(record,station,now){
 const window=nightWindow(now);
 if(!window)return unknown('daytime',station);
 const observed=Date.parse(record?.observedAt);
 if(record?.status!=='ok'||record.station!==station||!Number.isFinite(record.pm25)||record.pm25<0||record.pm25>1000||!Number.isFinite(observed))return unknown('missing-or-invalid',station);
 if(observed>now+5*60000||observed<window.start||now>=observed+MAX_AGE_MS)return unknown('stale-or-not-this-evening',station);
 return {status:'ok',pm25:record.pm25,unit:'µg/m³',station,observedAt:new Date(observed).toISOString(),validUntil:new Date(Math.min(observed+MAX_AGE_MS,window.end)).toISOString(),source:SOURCE,attribution:'AirKorea / Korea Environment Corporation',kind:'station observation',note:'Local station measurement; not actual N Seoul Tower lighting status.'};
}
export function createWorker({fetchUpstream=fetch,now=Date.now}={}){
 return {
  async fetch(request,env){
   const url=new URL(request.url);
   if(url.pathname==='/api/content')return handleCatalogRequest(request,env,{now:now()});
   if(url.pathname==='/api/content/jev-check')return handleJevCheck(request,env);
   if(url.pathname==='/api/content/evaluation')return handleRankingEvaluation(request,env);
   if(url.pathname.startsWith('/media/'))return handleMediaRequest(request,env,{now:now()});
   if(url.pathname.startsWith('/studies/'))return handleStudyRequest(request,env,{now:now()});
   if(!url.pathname.startsWith('/api/')){
    if(/\.(?:css|mjs|js|png|jpe?g|svg|webp|avif|ico|woff2?|map|json)$/.test(url.pathname))return env.ASSETS.fetch(request);
    return handleContentPage(request,env,{now:now()});
   }
   if(url.pathname!=='/api/air-quality')return json({error:'Not found'},404);
   if(request.method!=='GET')return json({error:'Method not allowed'},405);
   if(env.AIR_ENABLED!=='true'||!env.AIR_CACHE||!env.AIR_STATION)return json(unknown('not-configured',env.AIR_STATION));
   const instant=now();
   if(!nightWindow(instant))return json(unknown('daytime',env.AIR_STATION));
   // Read-only consumer: no visitor request can reach AirKorea, even on KV miss/failure.
   try{return json(publicReading(await env.AIR_CACHE.get(CACHE_KEY,'json'),env.AIR_STATION,instant));}
   catch{return json(unknown('cache-unavailable',env.AIR_STATION));}
  },
  async scheduled(controller,env){
   // There is no application retry loop; failures settle without another provider call.
   if(env.AIR_ENABLED!=='true'||env.AIR_PRODUCER_ENABLED!=='true'||env.AIR_DEPLOYMENT_KIND!=='production'||!env.AIR_CACHE||!env.AIRKOREA_SERVICE_KEY||!env.AIR_STATION)return;
   const instant=now(),scheduled=Number(controller.scheduledTime),slot=Math.floor(scheduled/SLOT_MS);
   // Reject delayed/replayed events from another slot, and require the intended 15m cron.
   if(controller.cron!=='*/15 * * * *'||!Number.isFinite(scheduled)||Math.floor(instant/SLOT_MS)!==slot||!nightWindow(instant)||!nightWindow(scheduled))return;
   try{
    // Best-effort duplicate-slot guard, NOT an atomic lock (KV is eventually consistent).
    // Normal cron budget <=96 attempts/day, fewer at night. Never retry a failed call.
    if(Number(await env.AIR_CACHE.get(SLOT_KEY))>=slot)return;
    await env.AIR_CACHE.put(SLOT_KEY,String(slot));
   }catch{return;}
   let record=unknown('provider-unavailable',env.AIR_STATION);
   let category='transport',httpStatus=null,providerCode=null;
   const signal=AbortSignal.timeout(5000);
   try{
    const upstream=new URL(ENDPOINT);
    // Use the portal's Decoding/raw secret. URLSearchParams performs the only encoding.
    upstream.search=new URLSearchParams({serviceKey:env.AIRKOREA_SERVICE_KEY,returnType:'json',numOfRows:'1',pageNo:'1',stationName:env.AIR_STATION,dataTerm:'DAILY',ver:'1.3'});
    // Workers rejects redirect:'error' before sending. Manual never forwards the key.
    const response=await fetchUpstream(upstream,{headers:{Accept:'application/json'},signal,redirect:'manual'});
    httpStatus=response.status;
    category=response.ok?'non-json':'http-error';
    const raw=await boundedBody(response);
    if(raw===null){category='body-too-large';throw Error('Stopped')}
    providerCode=xmlCode(raw);
    let payload;try{payload=JSON.parse(raw)}catch{throw Error('Stopped')}
    providerCode=payload?.response?.header?.resultCode;
    if(!response.ok)throw Error('Stopped');
    category=payloadCategory(payload,env.AIR_STATION);
    record=publicReading(normalizeAir(payload,env.AIR_STATION,instant),env.AIR_STATION,instant);
    category='ok-or-reading-unknown';
   }catch{if(signal.aborted)category='fetch-timeout';/* Never inspect/log exception text. */}
   // Failed/flagged data replaces the value with Unknown; failed persistence never retries.
   try{await env.AIR_CACHE.put(CACHE_KEY,JSON.stringify(record));}catch{}
   // Separate private key; no HTTP diagnostics route. Persistence failures never retry.
   try{await env.AIR_CACHE.put(DIAGNOSTIC_KEY,JSON.stringify(diagnostic(category,httpStatus,providerCode)),{expirationTtl:86400});}catch{}
  }
 };
}
export default createWorker();
