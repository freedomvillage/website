# Versioned prototype copy

`src/content/prototype-copy-data.mjs` contains only the visitor-facing copy for three existing draft records. It supplies the confirmed 2:10 PM time and restores six belief sections whose condensed paragraphs omitted parts of the source statement, and expands temporary visitor directions with parking and a clearly separate church office. It does not announce a new-building opening schedule or adopt new doctrine.

`publicCard` first validates the stored record and produces its normal public projection. The copy layer then applies only when the existing summary/facts or all eight section headings/paragraphs match the checked baseline. The visitor expansion additionally checks its title, summary, detail, facts, original contact actions and absence of authored sections. Held, synthetic and invalid records stay excluded. A future author edit takes precedence. Existing references, embedded cards, media, categories, priority and eligibility remain unchanged. The visitor page adds map actions while preserving its two existing contact actions.

All consumers use the same projection, including the API, homepage, topics and details. Practical-action cards now display their existing structured facts, so the service time appears once without adding it to both facts and summary.

This ships copy through the normal PR and Worker build while D1 storage remains unchanged. It creates no endpoint, credential, source-data export or database write. Private source and approval records are deliberately absent from this repository.

The optional prepared imports are `docs/imports/prototype-copy-2026-10-24.sql` and `docs/imports/temporary-visit-2026-10-24.sql`. It is not automatically run by the Worker or CI against remote storage. An authorized operator may later review and apply it through the existing D1 workflow. Before any import, validate each complete target record with the application schema and check draft/expiry state and the intended baseline. The SQL checks only selected eligibility flags and copy baselines; it does not validate the entire application schema. After a matching import the projection layer becomes inert. Cloud SQLite fixtures verify that import and projection agree. Native rendered verification remains separate from fixture validation.

## Connect email draft

For the checked Connect title/summary and existing exact Email us action, the public projection adds five fixed source interests (CX02–CX06). Existing prose, actions and sections stay intact. A changed title, summary or email action disables this additive helper. Normal stored-record validation/eligibility runs first; stored helper-like fields are ignored.

The progressively enhanced chooser independently selects interests and builds a `mailto:` draft. It collects no name/contact/question fields, persists nothing and makes no network request. The visitor reviews and sends in their mail app. There is no submission, enrollment or delivery acknowledgment. Without JavaScript, existing email/Kakao actions and authored content remain usable; the chooser stays hidden. This is partial interest handoff coverage, not a replacement for the missing consent-aware contact/prayer backend. Native mail-app, keyboard and responsive rendering checks remain pending.
