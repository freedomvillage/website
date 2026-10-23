# Freedom Village website

Deployment source for the approved public `freedomvillage/website` repository and permanent Cloudflare Worker `freedom-village-site`. The temporary review hostname is `next.freedomvillage.church`; branch review will use modern Worker Previews. Existing apex/www Webflow hosting must remain unchanged. This repository contains no credentials.

## Preserved source

Originally exported from prototype commit `b7ff6f976e58feb70796ef58c2a277722e6497d8`. `source-manifest.json` records the approved prototype source revision and current file hashes (`preservedFiles` plus `adaptedFiles`), while `originalImport` retains the original source commit, archive identity and imported hashes. Originally imported artwork files remain unchanged; subsequent approved UI and overlay changes are recorded separately. Unused historical artwork variants were excluded. Git history, `.openai`, `ARTWORK.md`, internal notes and source workspace files are deliberately excluded.

The composer is still a demonstration: it sends nothing. Appearance preference is a Secure, SameSite=Lax cookie, not prompt persistence. Seoul clock mode initializes before the scene is revealed and updates every 15 minutes and on visibility/pageshow/focus; Light/Dark remain fixed, and manual time pauses the clock until resumed. The season and Holy Week date remain captured once per page. The editable 2026–2035 season calendar uses verified USNO astronomical instants, selecting each season from midnight on its Seoul civil date; source instants and references are in `docs/seasons-2026-2035-seoul.json`. Outside that decade the nearest verified row is an approximation; extend the table before 2036. Christmas begins the Friday after US Thanksgiving through December 31; January 1 resets to winter.

Holy Week blossoms ramp from Palm Sunday through Easter with white, blush, lavender and soft yellow flowers, exterior vines and an Easter-only purple/gold HE IS RISEN banner. Manual spring settings provide an explicit preview override. Original paintings remain unchanged. The correct seasonal artwork loads hidden before reveal, with the existing logo during natural loading and a neutral fallback/retry on failure. No browser first-paint recording has verified this behavior locally.

PM2.5 starts Unknown / color off. Only a valid current-evening cached observation younger than one hour activates its interpreted tower color; expiry, missing data, failures, malformed values and future observations return it to off. The client clamps server validity to one hour from observation time and revalidates at render and exact expiry. Manual AQ preview remains explicit and does not persist. The cache/production schedule are configured, but a successful actual provider reading is not yet verified. Do not describe the prototype as live AQ coverage or a working chatbot.

## Local validation

Unit tests require Node 22+ and do not need dependencies installed:

```
npm test
node --check src/worker.mjs
```

This validates the Worker in a Node test harness and the exported assets/config, not a deployed Cloudflare service or browser. Wrangler is pinned to `4.152.0` with a lockfile. Install with `npm ci --ignore-scripts --registry=https://registry.npmjs.org`, then use `./node_modules/.bin/wrangler deploy --dry-run --env staging` and `--env next` before a real deploy. Cloudflare Builds is connected to GitHub `main`, using `npx wrangler deploy --env next`. A push to `main` can trigger deployment. Never run an unscoped/default-environment deployment.

## Review deployment (not the Webflow production site)

The existing Worker is `freedom-village-site`; `env.next.name` matches it. The legacy `staging` CLI configuration remains unused, and no separate staging Worker should be created. Default config is unconfigured; always choose the explicit intended environment. Public workers.dev and version-preview URLs remain disabled in the checked-in configuration. Runtime secrets are managed independently and must never be committed.

The intended workflow uses one Worker with a temporary `next.freedomvillage.church` hostname and modern branch previews. Both must require Google sign-in for the exact `freedomvillage.church` domain before being shared. Access, OAuth, preview setup and custom-domain configuration remain separate infrastructure work requiring the applicable authorization. Verify protection for ALL traffic, including custom-domain, workers.dev and preview paths; noindex is not access control. Keep apex, www, Webflow, mail, nameservers and registrar settings unchanged. Any eventual Webflow replacement requires a separate decision.

## Shared night-only air observations

See [AIR-CACHE.md](AIR-CACHE.md) for behavior, configuration and validation. HTTP requests only read a dedicated shared AQ KV namespace; visitors and preview sliders cannot call AirKorea. One production scheduled handler may refresh every 15 minutes, only during actual Seoul night. Previews share the public observation cache and have no provider key or producer schedule. The KV duplicate-slot guard is best effort, not an atomic exactly-once quota guarantee.

The UI starts at neutral Unknown and uses only a current-evening observation younger than 60 minutes; it returns to Unknown at expiry, supports explicit manual preview, and labels cached source/time separately from actual tower lighting. Missing, flagged, stale, failed and daytime data never become zero. Provider/KV failures leave the website usable.

Production is configured to refresh during actual Seoul night every 15 minutes using the dedicated `freedom-village-air-cache` namespace; previews use the same namespace with the producer disabled and no provider key. Actual API response, deployed binding and access validation must be recorded before claiming live coverage. Review URL exposure remains disabled pending Access setup. Do not log the key, upstream URL or raw provider response. The namespace ID and cron are tracked in `wrangler.jsonc`; Access and live API validation are independent rollout checks.

## Launch gates

- Finish `PUBLICATION-AUDIT.md`; confirm only the approved public repository and intended Worker/review URLs are targeted.
- Repeat pinned Wrangler dry runs after changing account/domain configuration.
- Confirm all five seasons, day/dusk/night, mobile keyboard/dialogs, reduced motion and cookie behavior in browser.
- Optimize artwork with approved visual QA (current assets are intentionally unmodified).
- Verify Worker-wide review access, noindex, TLS, redirects and no secret leaks.
- Test real AQ contract, budget enforcement, missing/stale/error UX before enabling.
- Audit actual content, links, accessibility, consent/privacy requirements before any real church launch.

References: https://developers.cloudflare.com/workers/static-assets/ ; https://developers.cloudflare.com/workers/wrangler/environments/ ; https://developers.cloudflare.com/workers/configuration/secrets/ ; https://www.data.go.kr/data/15075624/openapi.do
