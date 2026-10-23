# Private content pilot

The existing `next.freedomvillage.church` Access application protects every path with Google and the church email-domain allow rule. Worker development and preview URLs remain disabled. Content routes additionally require that hostname and the Access assertion header; that check is defense in depth, not independent JWT validation. Do not remove Access or enable alternate origins while these draft routes are active.

`CONTENT_DB` holds canonical private draft records. `CONTENT_MEDIA` reads original graphics from the private bucket. No record JSON, source editorial notes or graphics are published in this repository. The catalog projects an explicit safe field set; the media route serves only an eligible card's referenced image. Neither has upload, listing, arbitrary object-key or arbitrary upstream URL support. Responses use private/no-store caching. The full originals stay untouched; the renderer crops selected original imagery and renders facts as accessible text.

The SQL migration documents the existing manually applied schema. Do not reapply it blindly. Seed records remain outside the public repository. The breakfast location omits a conflicting floor; only its verified public responder form is used. The second pilot has no invented registration destination.

`/api/content/jev-check` is an authenticated diagnostic page. GET never calls TypeSafe. Its one POST uses a fixed synthetic query and only eligible card titles/descriptions, the existing server-side `TYPESAFE_API_KEY`, and the official HTTPS API. An atomic D1 claim permits at most one attempt, even with concurrent posts. Only validated typed judgments, usage or fixed failure categories are retained. No key, raw provider body, visitor query or identity is stored. Failed/interrupted attempts do not automatically retry. This is not a public search feature or a calibrated relevance policy.

The pilot's storage and flags apply only to `env.next`; branch preview hosting is not activated. Existing air-quality bindings, schedule, observation freshness and Webflow routes are unchanged. Rollback code to `15dd6d01a0196da323e2e89bd30dec8f62369ea3` through the established Cloudflare build flow to restore the prior static layout; the new isolated D1/R2 data can remain private and unused. No destructive down migration is needed.

Verification limit: no Mac test suite or local development server is run. Record actual build, authenticated rendering/media and one-call results separately; a successful build alone does not prove those behaviors.
