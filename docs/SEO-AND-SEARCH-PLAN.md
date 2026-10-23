# SEO and search foundations — next steps

Planning only. Keep next protected and nonindexed; preserve Webflow apex/www, existing Access, AQ and private media. Finish and inspect the current two detail pages before scaling content.

## Real website routes and server HTML

Use the current Worker/D1 stack to serve stable clean paths such as /events/<canonical-id> and, after taxonomy is settled, /topics/<slug>. Return meaningful HTML for list/detail content, headings, essential facts and real links on the initial request; JavaScript is optional enhancement for transitions and scene controls. A direct load or refresh must produce the same content without depending on a hash or a prior catalog fetch. Reuse canonical D1 facts across server HTML, API projection and client enhancements.

Match paths explicitly. Unknown records return HTTP 404; unavailable storage returns 503, not an empty 200 or an SPA fallback. Define publication/expiry eligibility separately from relevance. The current private draft selection is not a public publication policy. Extend Worker-first routes only for the required page paths, retaining existing API and private-media guards. Preserve the scene's first render, accessibility, link focus and browser back behavior.

Migrate old fragment links with a small client-side compatibility shim: the server never receives a URL fragment. New links use clean paths. Do not invent a server redirect that claims to receive the old hash.

Supply per-page title, concise description and appropriate social metadata from verified canonical fields. Add Event JSON-LD only when its fields are verified, not by inventing service times, locations or registration details. Future rich authored HTML requires an explicit sanitization/allowlist policy; do not send raw stored HTML to browsers indiscriminately.

While next is private, use response X-Robots-Tag noindex and robots disallow in addition to Access. Robots directives are not access control. Keep public canonical host and permanent redirect activation deferred until launch decisions are confirmed; do not emit a public canonical to an unrelated Webflow page or imply next is public.

At public launch, generate a sitemap from eligible published clean URLs only. Draft/private/hidden routes and media stay out. Decide expired-event archival/indexing behavior before inclusion. Optional llms.txt may provide a concise public content map; it must contain only approved public information. Useful semantic HTML and structured facts come first. Explore WebMCP or similar agent-readable capabilities later against official requirements and actual supported clients; no protocol selection, private-data exposure or tool-execution authority is implied.

## Search comparison before choosing an architecture

Use the same small representative set of synthetic visitor statements, questions, keywords, misspellings and full phrases for all approaches:

1. Lexical/full-text retrieval plus a modest typo/fuzzy baseline, using the stored canonical retrieval descriptions.
2. Jev scoring over the complete small eligible catalog, without candidate pruning.
3. A hybrid lexical candidate stage followed by Jev scoring.

Record per-query missed relevant cards, ranking quality, response latency and actual billed input/output token usage. Check useful partial matches and no-information/service-error cases distinctly. Compare hybrid candidate recall to the full small-catalog baseline so premature pruning is visible. Keep core-card inclusion independent from relevance and avoid duplicated IDs. Do not assume Jev always wins, introduce vector infrastructure, invent confidence cutoffs or infer provider capacity from a single sample.

Start with a small explicitly bounded batch within existing credits, no recharge/paid upgrade. The completed diagnostic was one immutable synthetic query with a one-call D1 guard; do not reset or reuse it as an unbounded benchmark. Visitor query logging/privacy choices remain unresolved, so do not collect real visitor inputs for this experiment. More cards and examples are needed to judge coverage beyond the pilot.

## Verification required

Verify clean-route direct load, refresh, meaningful initial HTML without JS, 404/503 status, crawlable links, metadata escaping and private/public eligibility. Recheck Access on page/API/media paths, disabled alternate origins and bucket privacy after deployment. Inspect actual compact and expanded layouts at desktop, intermediate and mobile widths, revise and inspect again. Record actual observations and limits; build success alone is not visual or runtime validation.

## Preferred category-first experiment to validate

Paul prefers exploring two Jev passes as the catalog grows: category descriptions first select multiple relevant categories; then score deduplicated cards from their union. Categories need not be navigation menus, and a card can belong to several. An uncertain first pass widens the set instead of silently discarding possible matches. Validate this against the lexical, complete small-catalog Jev and hybrid baselines above, especially missed-card recall and real token/latency costs. It is not necessary for the present two-card pilot and is not a proven performance claim.
