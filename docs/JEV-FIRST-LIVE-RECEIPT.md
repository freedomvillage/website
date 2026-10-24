# First live query: observable evidence

Use the existing protected-next session and composer. Do not add Access headers,
extract credentials, log the raw visitor question, or reset a failed/pending row.
Loading either receipt URL below is read-only and cannot invoke Jev.

For an operator without DevTools, open
`https://next.freedomvillage.church/api/content/intent?receipt=latest` in the
existing legitimate session. This returns only the authenticated user's most recent owned request, including
a pending outcome; its UUID/timestamp must still be matched to the intended
attempt. It does not establish which question was asked, since questions are
never stored. It never reruns recovery or ranking.

Before/after the first submission, `GET /api/content/intent` exposes:

| Field | Meaning |
| --- | --- |
| `status` | `ready` permits a first attempt; `unconfigured` lacks the existing flag/key; `pending-or-interrupted` has an atomic lock; `stopped` requires review. None proves provider success. |
| `recovery.status` | `not-run`, `ok`, a typed failure, or `pending-or-interrupted`. Only `ok` establishes that the fixed two-card response validated. |
| `recovery.model` | Actual validated response model. A pinned-model mismatch fails with schema code `model`. |
| `recovery.candidateIds` | Exactly `freedom-kids` and `connect-card`. |
| `recovery.ranked` | Actual per-ID scores, confidence and probability distributions. |
| `recovery.usage`, `estimatedCostUsd` | Actual validated token counts and calculated cost; unknown cost is never zeroed. |
| `recovery.failure`, `validation`, `httpStatus` | Safe failure stage/code, answer-count/index/model metadata and HTTP status, when available. No raw provider body. |
| `budgetUsd`, `spentOrReservedUsd` | Development ceiling and consumed/reserved allowance, not account balance. |

The composer exposes its random ID in
`document.getElementById('prompt-composer').dataset.requestId` **before** sending.
This contains no question. After success, `dataset.receipt` confirms the saved ID.
Another user receives404 for that UUID and cannot discover it through latest.
Legacy rows lacking a verified owner remain intact but are not exposed by this
endpoint and cannot be retroactively claimed. Authorized D1 administration is
separate; no query, cookie, raw identity or ownership reassignment is added.
Read `GET /api/content/intent?receipt=<URL-encoded request ID>` to verify:

| Field | Meaning |
| --- | --- |
| `requestId`, `status`, `completedAt` | Identity, final saved outcome and timestamp. A pending row returns 409; 404 alone does not establish that no recovery call occurred. |
| `requestedModel`, `model` | Requested pin and actual validated aggregate model. Failed ranking has `model:null`, not an invented attribution. |
| `candidateCount`, `candidateIds` | Complete eligible snapshot used for ranking; 71 is historical/fixture coverage, never an assumed current live count. |
| `batchPlan[].candidateIds`, `batches[].candidateIds` | The plan covers the full candidate snapshot exactly once. On full success, attempted batches cover that same set. After a failure, attempted batches may be only a prefix: untouched planned batches remain `not-attempted`, never reported as sent. |
| `batches[].status`, `model`, `usage`, `failure`, `validation` | Actual validated outcome or safe diagnosis for each attempted batch. |
| `ranked` | Canonical IDs and typed relevance scores, rechecked for eligibility at completion. A partial failure yields no successful ranking or substitute results. |
| `candidateInputs`, `candidateInputScope` | Allowlisted inputs for invocation-attempted/transport-uncertain batches only. This is not proof of provider receipt. No question or private fields. Legacy delivery is explicitly unestablished. |
| `batchPlan[].dispatch`, `batches[].dispatch` | `not-attempted` for untouched planned batches; `pending-or-uncertain` while a request may be in flight; `not-sent` for local rejection/deadline; `transport-uncertain` for an attempted call without an HTTP response; `http-response` when a response was received. |
| `rankedBeforeEligibility` | Complete typed scores before the final eligibility filter on new requests. Older receipts show null. |
| `selection` | Original rendering decision. Version 2 retains every eligible score and records a 24-resource page, `noticeMinimumScore:1`, `totalCount`, `closeMatchCount`, `after`, `nextCursor`, IDs/paths, below-threshold/unavailable/remaining IDs. Historical version 1 decisions retain their old cutoff semantics; missing originals remain null. |
| `usage`, `knownUsage`, `usageComplete`, `estimatedCostUsd` | Visitor batches only, including known failed-batch tokens. `usage`/cost are null when incomplete; `knownUsage` is only the known subtotal. Recovery has its separate receipt. |

The successful POST also returns `selectedIds` and server-rendered `html`. Verify
the shown card IDs and canonical links match `selectedIds`, not merely that the
request returned HTTP 200. The current `renderSelection` returns up to 24 resources from the full saved
ranking, with weak scores last. `closeMatchCount` uses the descriptive middle
score level (>=1) solely for the no-close-matches notice, never for exclusion.
An all-zero ranking still offers every eligible resource.

Follow `renderSelection.nextCursor` with an owned receipt ID and `after` to read
the next page. This GET cannot rank again or write any receipt/spend state.
Verify all pages preserve score order with no duplicates or omissions, and that
held, expired, removed or otherwise ineligible records are absent. A cursor can
name a record that has since disappeared; it still marks its saved rank position.
The returned `renderSelection` describes this page; `receipt.selection` remains
the original first rendering decision.

Receipt GETs also expose `currentInspection`, explicitly scoped to the **current
eligible catalog, not the original render**. It applies the current ranking/page
policy to saved scores and shows current public family/visit candidate inputs,
whether each was included in the saved snapshot, and its saved score if present.
The saved `inputProjection` distinguishes legacy `summary-facts-v1` from
`public-context-v2`. V2 sends categories, record type, bounded public detail/section
excerpts and action labels; it excludes URLs, related records, media metadata and
private/provenance fields. `currentInputProjection` describes the current preview,
not a retroactive change to the saved input. GET inspection does not alter the saved
receipt. A current catalog read failure leaves the saved
receipt readable with `currentInspection.status:unavailable`.

For a reported one-card result, compare all of: original `selection` when present,
actual returned `selectedIds`/DOM, candidate snapshot inclusion, per-ID score and
probability distribution, and current eligibility. There is no top-one cap or
lexical fallback. Three criteria mean score0–2. A score below1 can still assign
high probability to partial help, so it remains in the ranking. Do not blame a
typo or assert missing family content without the actual evidence.

If the browser times out or redirects to sign-in, label the outcome **uncertain**.
Read readiness and the same ID's receipt before retrying; the same draft reuses
its ID. A failed/pending recovery or interrupted provider request stays stopped
for review. Do not create a fresh ID or change queries to evade a stop. Preserve
the historical failed evaluation and its seven unrun cases.

Record only the fields above, the source revision/Workers version, and rendered
card/link evidence. Real provider success and actual rendering remain separate
from cloud fixtures and build receipts.

Older receipts without `batchPlan` may have included planned inputs after a
failed batch. Do not equate those inputs with sent requests. Existing successful
full-batch receipts and the historical failure are preserved without rewriting.
