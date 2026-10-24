/* Cached observations only. This client never calls an external air-data provider. */
(function (root) {
 'use strict';
 const POLL_MS = 15 * 60 * 1000, MAX_AGE_MS = 60 * 60 * 1000;
 function usableReading(value, now) {
  if (!value || value.status !== 'ok' || typeof value.pm25 !== 'number' || !Number.isFinite(value.pm25) || value.pm25 < 0 || value.pm25 > 1000) return null;
  // Require unambiguous instants, not device-local date strings. Invalid/flagged data fails closed.
  if (value.flagged === true || value.pm25Flag || typeof value.observedAt !== 'string' || typeof value.validUntil !== 'string' || !/T.*(?:Z|[+-]\d{2}:\d{2})$/.test(value.observedAt) || !/T.*(?:Z|[+-]\d{2}:\d{2})$/.test(value.validUntil)) return null;
  const observed = Date.parse(value.observedAt), suppliedUntil = Date.parse(value.validUntil);
  // Clamp an older server's longer TTL rather than rejecting a genuinely fresh observation.
  const until = Math.min(suppliedUntil, observed + MAX_AGE_MS);
  if (!Number.isFinite(observed) || !Number.isFinite(until) || observed > now || now - observed >= MAX_AGE_MS || until <= now) return null;
  return {status:'ok', pm25:value.pm25, observedAt:new Date(observed).toISOString(), validUntil:new Date(until).toISOString(), station:typeof value.station === 'string' ? value.station : '', source:typeof value.source === 'string' ? value.source : ''};
 }
 function createAirQualityClient(options) {
  const now = options.now || Date.now;
  const fetchCached = options.fetch || root.fetch.bind(root);
  const interval = options.setInterval || root.setInterval.bind(root), clearInterval = options.clearInterval || root.clearInterval.bind(root);
  const scheduleTimeout = options.setTimeout || root.setTimeout.bind(root), cancelTimeout = options.clearTimeout || root.clearTimeout.bind(root);
  let reading = null, lastAttempt = -Infinity, pending = null, serial = 0, timer = null, expiryTimer = null, stopped = false;
  function stateAt(time) {
   const state = options.getState();
   return {manual:!!state.manual, hidden:!!state.hidden, visualNight:Number(state.visualNight) > 0, realNight:!!options.isRealNight(time)};
  }
  // Fetch the shared cache by real conditions, never by the chosen scene theme.
  function allowed(state) { return !state.manual && !state.hidden && state.realNight; }
  function cancelPending() { serial++; if (pending) { pending.controller?.abort(); cancelTimeout(pending.timeout); pending = null; } }
  function clearExpiry() { if (expiryTimer !== null) cancelTimeout(expiryTimer); expiryTimer = null; }
  function display(state, time, reason) {
   clearExpiry();
   if (stopped) return;
   const fresh = usableReading(reading,time);
   if (!fresh) reading = null;
   // Expire at the observation's deadline even if the minute polling tick has not fired.
   // Every callback rechecks wall time, so sleep/throttling or clock changes cannot revive stale data.
   if (fresh) expiryTimer = scheduleTimeout(() => { expiryTimer = null; const time = now(); display(stateAt(time),time); }, Math.max(1,Date.parse(fresh.validUntil)-time));
   if (state.manual) return;
   // Observation validity is independent of whether the scene can display haze.
   const valid = fresh;
   options.render(valid || {status:'unknown',pm25:null,observedAt:null,validUntil:null,reason:reason || (!state.realNight ? 'daytime' : !state.visualNight ? 'scene-daytime' : 'missing-or-stale')});
  }
  async function tick() {
   if (stopped) return;
   const time = now(), state = stateAt(time);
   if (!allowed(state)) { cancelPending(); display(state,time); return; }
   display(state,time);
   if (pending || time - lastAttempt < POLL_MS) return;
   lastAttempt = time;
   const requestId = ++serial, controller = typeof root.AbortController === 'function' ? new root.AbortController() : null;
   const entry = {controller, timeout:null}; pending = entry;
   entry.timeout = scheduleTimeout(() => { if (pending === entry) { serial++; controller?.abort(); pending = null; reading = null; display(stateAt(now()),now(),'unavailable'); } },8000);
   try {
    const response = await fetchCached('/api/air-quality',{method:'GET',credentials:'same-origin',cache:'no-store',headers:{Accept:'application/json'},signal:controller?.signal});
    if (!response.ok) throw new Error('Unavailable');
    const payload = await response.json();
    if (requestId !== serial || stopped || !allowed(stateAt(now()))) return;
    reading = usableReading(payload,now());
    display(stateAt(now()),now(),reading ? undefined : 'missing-or-stale');
   } catch {
    if (requestId !== serial || stopped) return;
    reading = null; display(stateAt(now()),now(),'unavailable');
   } finally {
    cancelTimeout(entry.timeout);
    if (pending === entry) pending = null;
   }
  }
  function start() { if (timer !== null) return; stopped = false; void tick(); timer = interval(() => { void tick(); },60000); }
  function stop() { stopped = true; cancelPending(); clearExpiry(); if (timer !== null) clearInterval(timer); timer = null; }
  return {tick,start,stop};
 }
 root.createAirQualityClient = createAirQualityClient;
 root.validateCachedAirReading = usableReading;
})(globalThis);
