-- Private next-site content experiment; no visitor accounts, queries or form submissions.
CREATE TABLE content_cards (
  id TEXT PRIMARY KEY NOT NULL,
  status TEXT NOT NULL DEFAULT 'draft' CHECK(status IN ('draft', 'published', 'archived')),
  content_json TEXT NOT NULL CHECK(json_valid(content_json) AND length(content_json) <= 32768),
  editorial_json TEXT NOT NULL DEFAULT '{}' CHECK(json_valid(editorial_json)),
  published_at TEXT,
  expires_at TEXT,
  updated_at TEXT NOT NULL,
  revision INTEGER NOT NULL DEFAULT 1 CHECK(revision >= 1),
  CHECK(status != 'published' OR published_at IS NOT NULL),
  CHECK(expires_at IS NULL OR published_at IS NULL OR expires_at > published_at)
);
CREATE INDEX content_cards_status_id ON content_cards(status, id);
CREATE TABLE content_checks (
  id TEXT PRIMARY KEY NOT NULL,
  result_json TEXT CHECK(result_json IS NULL OR json_valid(result_json)),
  created_at TEXT NOT NULL
);
