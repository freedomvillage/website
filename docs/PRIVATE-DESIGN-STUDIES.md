# Private finite design comparisons

`/studies/:slug` reads a bounded `design-study:<slug>` record from `content_checks`, for example `design-study:sample`. This is a private draft comparison, separate from the eligible content catalog and Jev data. It introduces no visitor assignment, analytics or live A/B experiment.

The record contains `version: 1`, `isDesignStudy: true`, a title/summary and two or three labeled alternatives. Each alternative has a unique safe ID, a label/description and one to four finite groups. A group has a title and up to six canonical card IDs; the whole study references at most 24 unique IDs. Existing source copy, destinations and eligible media are reused. Held, expired and synthetic content cards remain excluded.

Each occurrence receives a namespaced DOM ID, while links keep the canonical content destination. There is no incremental-feed control inside a finite set. The page uses the same protected shell, skip-link, no-JavaScript fallback and private/noindex metadata as other next-site pages. Study definitions and private source data are seeded separately and do not belong in the public repository.
