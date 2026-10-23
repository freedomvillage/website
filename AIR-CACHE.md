# Shared night-only air observations

This patch is based on public source `d41a37b`; source artwork/calendar/Holy Week behavior from `6e653c37d9ee6d7708a08863f7cbdc6dcfd66578` is preserved. Apply only this scoped patch to the current repository. It deliberately does not replace `wrangler.jsonc`, rename a Worker, create bindings or enable live calls.

## Behavior

- The HTTP `/api/air-quality` handler ONLY reads shared KV. Cache misses, errors, custom query parameters and visitors cannot call AirKorea.
- One production scheduled handler polls at `*/15 * * * *`, only from actual Seoul sunset until the following civil dawn. Real current date/time is independent of all scene controls. This is a scene-data policy, not physical tower opening/lighting hours.
- Normal schedule ceiling: 96 opportunities/day, fewer after the night gate. One call per eligible event; no application retries. A saved slot suppresses usual duplicate deliveries. KV is eventually consistent, so this is NOT an atomic exactly-once or hard billing guarantee under concurrent duplicate platform deliveries. No Durable Object is required for this modest best-effort design.
- HTTP and UI validate observation age (60 minutes maximum), not download time. Observations before the current evening's sunset, missing/flagged/invalid values, failed provider reads and daytime return Unknown with no numeric value. First evening stays neutral until an evening observation arrives.
- The browser requests only the same-origin cached endpoint, only while visible, visually in night, actual Seoul night, and not in manual AQ override. It polls at most every 15 minutes and rechecks expiry each minute. Slider movements cannot trigger a provider fetch. Manual override is explicitly labeled and never persisted.
- KV propagation can delay a new reading by roughly a minute or longer. No claim of instantaneous synchronization is made.

## Minimal configuration — merge into the owner's current config

Use the permanent Worker `freedom-village-site`; keep any currently selected CLI environment only if the owner is retaining it. Do not restore old Worker names or recreate a staging project. Do not touch apex/www/Webflow.

Create/reuse ONE dedicated KV namespace containing public AQ observations only. Bind `AIR_CACHE` to its confirmed ID in production. Preview bindings must explicitly use the SAME ID; do not create an isolated preview namespace if the goal is shared readings. Binding IDs are configuration, not secrets.

Production vars after authorized validation:

```
AIR_ENABLED = "true"
AIR_PRODUCER_ENABLED = "true"
AIR_DEPLOYMENT_KIND = "production"
AIR_STATION = "용산구"
```

Production alone has the decoded/raw `AIRKOREA_SERVICE_KEY` secret and the sole cron `*/15 * * * *`. URLSearchParams performs the only URL encoding. Never commit/log a key or upstream URL. Keep both enable flags false until real entitlement/schema validation and binding verification are complete.

Modern Worker `previews` block (merge at the supported level of the owner's config):

```json
{
  "vars": {
    "AIR_ENABLED": "true",
    "AIR_PRODUCER_ENABLED": "false",
    "AIR_DEPLOYMENT_KIND": "preview",
    "AIR_STATION": "용산구"
  },
  "kv_namespaces": [
    { "binding": "AIR_CACHE", "id": "REPLACE_WITH_THE_SAME_CONFIRMED_AQ_NAMESPACE_ID" }
  ]
}
```

This snippet is documentation, not an applied configuration. Use false for preview AIR_ENABLED until the shared namespace and API contract are verified. Previews do not inherit production vars/bindings. Assets stay top-level; modern previews do not receive Cron Triggers. Do NOT add the AirKorea secret to Preview Base or individual previews. Do not use production-kind flags there.

KV runtime bindings expose get/put methods; this code is read-only on HTTP, but that is not a read-only infrastructure ACL. Only reviewed/trusted preview code should receive the AQ namespace. Do not store confidential data in it. If stronger isolation is needed later, use a dedicated read-only service endpoint instead of sharing a writable KV binding.

Deployment identity needs permission to manage the selected Worker, its cron/settings and its KV binding; creating a namespace requires the relevant KV management permission. Visitors/previews need no AirKorea account or API key. Do not grant broader DNS/account permissions merely for cache reads.

## Validation and rollout

- `npm test`: focused producer/client tests plus existing regression suite. No real API key is used.
- Verify the actual AirKorea measurement operation response with the saved key through the authorized production path before enabling. Current schema expects response.header.resultCode `00`, body.items array, pm25Value, pm25Flag, stationName if present, and KST dataTime `YYYY-MM-DD HH:mm`.
- Bind one AQ namespace to production and previews intentionally. Confirm producer flags/cron exist only on production and no secret exists in previews.
- At actual night, observe one scheduled refresh, sanitized cache contents, matching HTTP output in both sites and neutral Unknown on simulated stale/missing data. Do not force a daytime upstream request just to make the tower colorful.
- Confirm preview Access protects all traffic and test unauthorized as well as authorized requests before sharing. No access policy is changed by this patch.
- Provider or KV outages must leave the site working and AQ Unknown. Roll back code/config independently if needed; preserve Webflow.

Primary references: https://developers.cloudflare.com/workers/previews/configuration/ ; https://developers.cloudflare.com/workers/runtime-apis/handlers/scheduled/ ; https://gml.noaa.gov/grad/solcalc/solareqns.PDF

## Current rollout configuration

The approved dedicated namespace is `freedom-village-air-cache` (`058e6e2985d24f31b5e36d73bdd1ea12`) in the existing Freedom Village Cloudflare account. `env.next` binds production and modern Preview Base to that same AQ-only namespace. Production enables the sole night-gated `*/15 * * * *` schedule; previews have producer false, kind preview and no key/cron. This configuration initiates authorized real-response validation; it is not evidence that a provider reading has been obtained. Public review routing remains disabled pending separate Access setup.
