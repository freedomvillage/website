# Bounded public ranking context

The first successful live requests covered all71 eligible cards in two batches,
but the model saw only title, summary and facts. This omitted ministry first-visit
information and the actual substance of belief sections. That is an observed input
coverage gap, not evidence of a top-one cap, missing family records or a typo bug.

`public-context-v2` retains title, summary and canonical facts, then adds only the
eligible public record type, category labels, bounded detail/section excerpts and
public action labels. It never spreads stored records or forwards staff notes,
source/provenance fields, media metadata, URLs, owner identities or credentials.
The caller still obtains records through publicCard's validation and expiry/hold
filters. This does not invent new content or infer operational facts from a tag.

Every detail paragraph receives a share of a600-character excerpt budget. Every
section, including later belief topics, retains a100-character heading and a240-
character paragraph budget shared across its paragraphs. Truncated prose ends
with an ellipsis. There are at most12 detail paragraphs,10 sections and6 action
labels; source field limits are checked before projection. These are bounded
excerpts, not a claim that the full document was sent.

The relevance question now explicitly permits a useful answer to one meaningful
part of a multi-part intent. It still rejects incidental shared words and invented
schedules, availability or capabilities. The three descriptive criteria and 0–2 score contract remain. The full eligible
ranking is shown in pages of 24 resources; the middle score level controls only
the no-close-matches notice.

All eligible candidates are still covered by byte/card-bounded batches. There is
no lexical shortlist, hardcoded query boost or silent truncation of the catalog.
If whole-catalog limits cannot be met, the request fails before provider dispatch.
Existing request, batch, time, rate, spend, failure, owner and idempotency safeguards
remain. Receipts label the input projection and retain only actually attempted or
transport-uncertain candidate inputs, separately from the full execution plan.

Cloud fixtures cover public-only projection, late-section/paragraph coverage,
privacy sentinels, whole71-card coverage, request bounds and invalid-context refusal.
They prove input and execution mechanics, not relevance quality. Representative
live before/after queries are required to assess useful coverage, score distribution
and complementary resources. Fixture passes establish mechanics, not model
relevance quality; ranking errors can still put unrelated resources near the top.

Official Score contract: https://docs.typesafe.ai/primitives/score
