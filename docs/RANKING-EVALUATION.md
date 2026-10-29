# Bounded private ranking comparison

Real source catalog first. Fixed synthetic visitor queries are separate from synthetic cards, visitor messages and form submissions. Keep expected IDs and source verification notes in private D1 fixtures, not in public source. The existing immutable two-card receipt stays unchanged.

First compare a transparent keyword/phrase/one-edit baseline against Jev over the complete small eligible catalog. Report all expected-ID intersections and raw ranks/scores; do not invent confidence cutoffs or call a partial match a complete answer. Record actual model, billable input/output tokens, latency and the documented unit-price estimate. A content gap, model error and service failure are different outcomes.

Follow with a clearly labeled hybrid candidate-recall simulation before spending on a separate hybrid request. It reuses full-catalog scores and cannot establish hybrid request cost/latency or model equivalence. The preferred category-first multi-label union then card-scoring experiment remains a later measured comparison; uncertainty must widen candidate coverage. Do not prune candidates without checking missed relevant cards.

Current official model documentation (https://docs.typesafe.ai/models, read 2026-10-23) lists jev-1.14.0 at $0.042 per million input tokens, output free. Pin the evaluation model for reproducibility and record its returned version. This is a unit-price estimate, not an invoice or a claim about remaining account credits. Verify the actual console balance before approving the bounded fixture run; no recharge or plan change.

No real visitor query logging or generated public answers are introduced. Staff diagnostic results remain behind existing next-site Access. Model relevance quality still requires separately authorized representative evaluation; mocked pipeline coverage establishes mechanics only.


The canonical planner is now `synthetic-ranking-evaluation-v2`, sharing visitor
projection, model/rubric versions, 256-candidate limit, 64-card/40,000-byte batches
and 24-batch maximum. A 257th candidate, duplicate ID or invalid public projection
fails before dispatch. Fixed synthetic execution identity hashes the actual
requests (including the synthetic question, time context and batch plan), while
the stable public dataset fingerprint excludes questions and private metadata.
The injected server clock controls eligibility and Asia/Seoul reference context.

New evaluation execution is disabled unconditionally in the HTTP handler. Prior
fixture approval cannot authorize this new contract. GET and POST do not create
locks/claims, update historical rows, reset budgets, alter credit verification or
call a provider. Historical failed/null claims remain untouched and stop further
execution. A separately bounded paid authorization and reviewed execution path
are required before enabling any new experiment. The explicitly injected
`evaluateSyntheticFixture` transport exists for cloud mocked parity tests; the
HTTP handler never calls it. There is no automatic execution on test discovery.
