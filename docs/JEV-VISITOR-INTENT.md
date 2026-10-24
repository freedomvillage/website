# Protected visitor intent

The bottom composer posts a question to `/api/content/intent`. The Worker sends
only the question and eligible public card titles, summaries and facts to Jev.
It returns existing canonical cards, not generated church facts or answers.
Questions are not stored in D1, query strings, browser storage or application logs.
The composer asks visitors to avoid personal or sensitive details.

The 2026-10-24 authorized recovery is one fixed synthetic two-card check. Its
immutable `jev-intent-recovery-v1` receipt references the historical failed
`ranking-eval-v1:short-stay-kids` without modifying that failure or resuming its
seven stopped evaluation cases. A failed, uncertain or pending recovery blocks
more requests. Merely loading a page never calls the provider.

Every eligible card is considered: follow raw catalog cursors even across empty
validated pages, then split by the existing 64-card/40,000-byte request contract.
There is no lexical shortlist that can discard implicit needs. The bounded limit
is 256 valid cards and 24 batches; exceeding it fails before spending. Responses
are typed scores with independent criteria, merged by score then canonical ID.
Every eligible resource remains in score order, including weak and zero scores.
The middle descriptive score level (1) controls only a no-close-matches notice;
it never filters resources and is not a calibrated probability. Pages contain up
to 24 ranked resources. Current eligibility is checked after ranking and on every
replay or continuation.

Continuation uses `GET /api/content/intent?receipt=<owned ID>&after=<ranked ID>`.
The cursor advances through the saved ranking, so removing earlier records or
the cursor record cannot skip unseen resources. This GET cannot invoke Jev or
change receipts, locks or spending. New catalog records need a new explicit
question; they are not silently scored or inserted into an existing ranking.
Version 2 render selections expose total/close-match counts and the next cursor.
Stored original selections, including historical version 1 cutoff decisions,
remain evidence of their original rendering, separate from current renderSelection.

Requests use an atomic D1 single-flight lock, a 10-second global interval, a
$0.10 total development budget and a conservative $0.003 reservation per call.
Jev 1.14.0 is pinned. The reservation covers the documented default 64k context at
$0.042/million input tokens (output is free); actual validated usage settles it.
Unknown usage retains its reservation. A failure stops subsequent spending; a
crashed request retains its lock. No automatic retries, lock expiry or reset API
exists. The old fixed-case credit verification is not silently edited or reused.
The new recovery follows Paul's explicit approval of bounded real integration
and confirmation that existing credit is sufficient; no purchase is involved.

Each upstream call times out after eight seconds, the sequence has a 55-second
deadline, input is limited to 500 characters/4KB and five seconds to read, and
provider output is limited to 64KB. Origin/content-type checks supplement the
existing Cloudflare Access boundary. No credential or Cloudflare Access policy is changed. Saved diagnostics add an
originating-user ownership check through the existing Access identity service,
with no caller-supplied owner identity accepted. Responses are private/no-store/noindex. Provider URLs
are fixed and redirects are not followed.

Client-generated random request IDs make uncertain-outcome replay idempotent.
Stored receipts contain candidate IDs, typed scores, model, safe failure
classification and token usage, never the visitor question or raw provider body.
`GET /api/content/intent` reads readiness without invoking Jev; its `receipt`
parameter reads a saved request receipt under the same Access protection.

Contract references checked 2026-10-24:
- https://docs.typesafe.ai/api/system-one
- https://docs.typesafe.ai/primitives/score
- https://docs.typesafe.ai/models

Cloud fixtures intercept all provider calls. Passing fixtures and a deployment
are not evidence of a successful real request. Runtime acceptance requires the
actual recovery outcome, model/usage, complete candidate coverage, returned IDs,
rendered results and truthful failure behavior through a legitimate private
session. No automated Mac tests or Access bypass should be used to obtain it.
