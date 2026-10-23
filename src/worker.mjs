// Adapter contract is fixture-tested, not yet verified against an authorized live key.
const SOURCE = 'https://www.airkorea.or.kr/';
const ENDPOINT = 'https://apis.data.go.kr/B552584/ArpltnInforInqireSvc/getMsrstnAcctoRltmMesureDnsty';
const MAX_AGE_MS = 3 * 60 * 60 * 1000;
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
function json(body, status = 200, cache = 'no-store') {
  return new Response(JSON.stringify(body), {status, headers:{'Content-Type':'application/json; charset=utf-8', 'Cache-Control':cache, 'X-Content-Type-Options':'nosniff', 'X-Robots-Tag':'noindex'}});
}
export function createWorker({fetchUpstream = fetch, now = Date.now, cache} = {}) {
  return {async fetch(request, env, ctx) {
    const url = new URL(request.url);
    if (!url.pathname.startsWith('/api/')) return env.ASSETS.fetch(request);
    if (url.pathname !== '/api/air-quality') return json({error:'Not found'},404);
    if (request.method !== 'GET') return json({error:'Method not allowed'},405);
    if (env.AIR_ENABLED !== 'true' || !env.AIRKOREA_SERVICE_KEY) return json({status:'unavailable',reason:'Live air data is not configured.'},503);
    const station = env.AIR_STATION;
    if (!station) return json({status:'unavailable'},503);
    // Fixed URL and station: visitors cannot turn this into an open proxy.
    const key = new Request(url.origin + '/api/air-quality?station=' + encodeURIComponent(station));
    const edgeCache = cache ?? globalThis.caches?.default;
    let hit;
    try { hit = await edgeCache?.match(key); } catch { /* cache outage must not break the endpoint */ }
    if (hit) return hit;
    try {
      const upstream = new URL(ENDPOINT);
      // Secret must be the decoded service key; URLSearchParams encodes once.
      upstream.search = new URLSearchParams({serviceKey:env.AIRKOREA_SERVICE_KEY,returnType:'json',numOfRows:'1',pageNo:'1',stationName:station,dataTerm:'DAILY',ver:'1.3'});
      const response = await fetchUpstream(upstream,{headers:{Accept:'application/json'},signal:AbortSignal.timeout(5000),redirect:'error'});
      if (!response.ok) throw new Error('Provider unavailable');
      const raw = await response.text();
      if (raw.length > 65536) throw new Error('Oversized response');
      const reading = normalizeAir(JSON.parse(raw),station,now());
      const result = json(reading,200,'public, max-age=1800');
      if (edgeCache && ctx?.waitUntil) ctx.waitUntil(edgeCache.put(key,result.clone()).catch(() => {}));
      return result;
    } catch {
      // Never log upstream URL/key or falsely substitute a healthy reading.
      return json({status:'unavailable',reason:'Current air data could not be verified.'},503);
    }
  }};
}
export default createWorker();
