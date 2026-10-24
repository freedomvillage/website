# Versioned prototype copy

`src/content/prototype-copy-data.mjs` contains only the visitor-facing copy for two existing draft records. It supplies the confirmed 2:10 PM time and restores six belief sections whose condensed paragraphs omitted parts of the source statement. It does not announce a new-building opening schedule or adopt new doctrine.

`publicCard` first validates the stored record and produces its normal public projection. The copy layer then applies only when the existing summary/facts or all eight section headings/paragraphs match the checked baseline. Held, synthetic and invalid records stay excluded. A future author edit takes precedence. References, embedded cards, actions, media, categories, priority and eligibility remain unchanged.

All consumers use the same projection, including the API, homepage, topics and details. Practical-action cards now display their existing structured facts, so the service time appears once without adding it to both facts and summary.

This ships copy through the normal PR and Worker build while D1 storage remains unchanged. It creates no endpoint, credential, source-data export or database write. Private source and approval records are deliberately absent from this repository.

The optional prepared import is `docs/imports/prototype-copy-2026-10-24.sql`. It is not automatically run by the Worker or CI against remote storage. An authorized operator may later review and apply it through the existing D1 workflow. Its predicates preserve newer or held copy; after import the projection layer becomes inert. Cloud SQLite fixtures verify that import and projection agree. Native rendered verification remains separate from fixture validation.
