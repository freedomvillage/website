# Freedom Village staging preparation

Deployment source for the approved public `freedomvillage/website` repository and `staging` / `next` hosts. This package itself contains no credentials or deployed infrastructure. Existing apex/www Webflow hosting must remain unchanged.

## Preserved source

Originally exported from prototype commit `b7ff6f976e58feb70796ef58c2a277722e6497d8`. `source-manifest.json` records the current approved UI revision and current file hashes, while `originalImport` retains the original source commit, archive identity and imported hashes. Referenced artwork remains unchanged; subsequent approved UI changes are recorded separately. Unused historical artwork variants were excluded. Git history, `.openai`, `ARTWORK.md`, internal notes and source workspace files are deliberately excluded.

The composer is still a demonstration: it sends nothing. Appearance preference is a Secure, SameSite=Lax cookie, not prompt persistence. Time and air sliders remain explicitly manual. Seasonal daylight uses representative Seoul dates with approximate KST sunrise/sunset and civil-twilight transitions; it is not live time. PM2.5 Unknown / color off preserves the selected numeric value and retains neutral nighttime tower lighting. The new air endpoint is **not connected to the scene** and defaults to disabled. Do not describe the prototype as live AQ or a working chatbot.

## Local validation

Unit tests require Node 22+ and do not need dependencies installed:

```
npm test
node --check src/worker.mjs
```

This validates the Worker in a Node test harness and the exported assets/config, not a deployed Cloudflare service or browser. Wrangler is pinned to `4.152.0` with a lockfile. Install with `npm ci --ignore-scripts --registry=https://registry.npmjs.org`, then use `./node_modules/.bin/wrangler deploy --dry-run --env staging` and `--env next` before a real deploy. No deployment automation is included. Never run an unscoped/default-environment deployment.

## Staging and next (not live production)

`wrangler.jsonc` defines two isolated Worker names and environment vars. No account ID, routes, custom domains, secrets, public workers.dev or version-preview URLs are enabled. This intentionally cannot produce a public website just by being uploaded. Default config is unconfigured; always choose an explicit environment.

After confirmation of the account/zone, configure only `staging.freedomvillage.church` and `next.freedomvillage.church`. Do not touch apex, www, Webflow records, mail records, nameservers or registrar settings. Before exposing staging, apply worker-level Access protection for ALL traffic, not only the custom hostname. Verify both authorized and unauthorized requests; noindex is NOT access control. Check custom-domain, workers.dev and preview URL bypasses. Verify TLS and the exact release commit. Record rollback to the prior Worker version; DNS/Webflow cutover is a separate decision.

Suggested approval flow: staff proposal branch -> checks -> staging review -> Paul approves the exact commit -> promote that same commit to next. Production and eventual Webflow replacement require separate authorization. Do not grant staff Cloudflare/DNS admin merely to suggest content. GitHub branch protection settings depend on repository visibility and account plan; configure and verify before relying on them.

## AirKorea adapter (disabled design)

`GET /api/air-quality` uses a fixed HTTPS official endpoint and fixed configured station, decoded `AIRKOREA_SERVICE_KEY` secret, 5-second timeout, redirect rejection and sanitized failures. Secrets never enter static assets or API responses. Do not paste keys into chat, commit them, or log upstream URLs. Configure secrets independently per environment only after approval.

Before enabling `AIR_ENABLED=true`, confirm an authorized AirKorea key, operation entitlement, actual station name, current documented schema and a real successful response. Tests use invented fixtures, not provider evidence. Confirm source terms/attribution and response field validity. The adapter uses measured `pm25Value`, never overall pollution grade; it retains units, timestamp and source and marks observations older than three hours stale. Missing, flagged or malformed readings are unavailable, never zero.

The optional edge cache lasts 30 minutes and is per location, not a global quota limiter. The development service quota may be only 500 calls/day: before public enablement implement and validate a centrally scheduled fetch plus KV last-good record (or an equivalent provider-budget limit). That design and outage persistence are not implemented here. Current stale data is labeled but no durable last-good cache is promised. Visitor parameters cannot choose an upstream or station.

UI integration is a separate remaining step: distinguish manual vs live clearly, retain source/time/stale text, suppress confident tower color on unavailable data, and label color as an interpretation rather than actual tower lights. Air failures must not break the site.

## Launch gates

- Finish `PUBLICATION-AUDIT.md`; confirm only the approved public repository and two hosts are targeted.
- Repeat pinned Wrangler dry runs after changing account/domain configuration.
- Confirm all five seasons, day/dusk/night, mobile keyboard/dialogs, reduced motion and cookie behavior in browser.
- Optimize artwork with approved visual QA (current assets are intentionally unmodified).
- Verify staging access, noindex, TLS, redirects and no secret leaks.
- Test real AQ contract, budget enforcement, missing/stale/error UX before enabling.
- Audit actual content, links, accessibility, consent/privacy requirements before any real church launch.

References: https://developers.cloudflare.com/workers/static-assets/ ; https://developers.cloudflare.com/workers/wrangler/environments/ ; https://developers.cloudflare.com/workers/configuration/secrets/ ; https://www.data.go.kr/data/15075624/openapi.do
