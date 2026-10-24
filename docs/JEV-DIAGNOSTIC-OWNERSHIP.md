# Saved diagnostic ownership

Saved visitor-ranking receipts are scoped to the verified originating Access
user, including replay and pending claims. UUID knowledge is not authorization.
`receipt=latest` queries only the caller's owned rows. A foreign, missing or legacy
unowned row returns the same404. Older data is retained without deletion or
retroactive ownership assignment; the existing authorized D1 console is a separate
administrative path.

The Worker resolves the existing CF_Authorization session using the fixed
`https://next.freedomvillage.church/cdn-cgi/access/get-identity` endpoint. Cloudflare
validates that session. It is never derived from a client-supplied email/owner
header or an unverified JWT decode. The response must identify the existing FVC
account and a valid user UUID; service-token identities, absent/ambiguous cookies,
redirects, wrong accounts and malformed/oversized responses fail closed before
D1 receipt access or provider spending. The lookup has a3-second timeout and32KB
response cap, forwards only the Access cookie to that same fixed origin, and does
not follow redirects. No login, credential, audience or Access-policy change is
introduced. The supported fields/endpoint were observed read-only in the existing
signed-in next session; profile values were neither printed nor retained.

Only a SHA-256 account/user scope is stored with each new claim. Raw cookies,
JWTs, email, IP address and identity JSON are never logged, stored or returned.
The owner scope is not part of public receipt responses. A pending claim is owned
before a provider call can begin. Other reviewers cannot discover it or replay it.
Shared readiness exposes only global availability/spend and a minimal fixed-check
status to nonowners, not someone else's saved result. Ownership is user-scoped;
rotating a session does not create another owner if the verified UUID is unchanged.

Batch evidence is separate from execution plans. Planned untouched IDs are marked
not-attempted. A persisted in-flight plan is pending-or-uncertain. Local validation
or deadline rejection is not-sent; a transport exception is transport-uncertain;
an HTTP response is http-response. Candidate inputs are retained only for batches
whose provider invocation was attempted or transport-uncertain, not every planned
batch. This never claims that an uncertain call reached the provider. Old receipts
without these fields retain an explicit legacy-delivery-not-established label.

Cloud fixtures verify cross-user GET/latest/replay/pending isolation, preserved
legacy rows, spoofed identity headers, identity-service failure, wrong accounts,
minimal credential forwarding, and sent/uncertain/unattempted batch distinctions.
They never contact Access or Jev. Runtime identity lookup and actual paid ranking
results remain separate verification steps.

Official service contract:
https://developers.cloudflare.com/cloudflare-one/tutorials/extend-sso-with-workers/
https://developers.cloudflare.com/cloudflare-one/access-controls/applications/http-apps/authorization-cookie/application-token/
