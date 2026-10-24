# First live query: observable evidence

Use the existing protected-next session and composer. Do not add Access headers,
extract credentials, log the raw visitor question, or reset a failed/pending row.
Loading either receipt URL below is read-only and cannot invoke Jev.

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
Read `GET /api/content/intent?receipt=<URL-encoded request ID>` to verify:

| Field | Meaning |
| --- | --- |
| `requestId`, `status`, `completedAt` | Identity, final saved outcome and timestamp. A pending row returns 409; 404 alone does not establish that no recovery call occurred. |
| `requestedModel`, `model` | Requested pin and actual validated aggregate model. Failed ranking has `model:null`, not an invented attribution. |
| `candidateCount`, `candidateIds` | Complete eligible snapshot used for ranking; 71 is historical/fixture coverage, never an assumed current live count. |
| `batches[].candidateIds` | Their union must equal the candidate snapshot exactly once. No candidates may be silently dropped at the 64-card/byte boundary. |
| `batches[].status`, `model`, `usage`, `failure`, `validation` | Actual validated outcome or safe diagnosis for each attempted batch. |
| `ranked` | Canonical IDs and typed relevance scores, rechecked for eligibility at completion. A partial failure yields no successful ranking or substitute results. |
| `usage`, `knownUsage`, `usageComplete`, `estimatedCostUsd` | Visitor batches only, including known failed-batch tokens. `usage`/cost are null when incomplete; `knownUsage` is only the known subtotal. Recovery has its separate receipt. |

The successful POST also returns `selectedIds` and server-rendered `html`. Verify
the shown card IDs and canonical links match `selectedIds`, not merely that the
request returned HTTP 200. Selection uses the provisional descriptive middle
score level (>=1), capped at 24; it is not a calibrated certainty claim. Eligible
content can change after a snapshot, so a replay rechecks current records again.
An `ok` ranking with no clear matches is valid and must not manufacture an answer.

If the browser times out or redirects to sign-in, label the outcome **uncertain**.
Read readiness and the same ID's receipt before retrying; the same draft reuses
its ID. A failed/pending recovery or interrupted provider request stays stopped
for review. Do not create a fresh ID or change queries to evade a stop. Preserve
the historical failed evaluation and its seven unrun cases.

Record only the fields above, the source revision/Workers version, and rendered
card/link evidence. Real provider success and actual rendering remain separate
from cloud fixtures and build receipts.
