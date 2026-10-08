CREATE TABLE toeic_tests (
  id TEXT PRIMARY KEY,
  document TEXT NOT NULL,
  created_at INTEGER NOT NULL
);
CREATE TABLE toeic_attempts (
  id TEXT PRIMARY KEY,
  test_id TEXT NOT NULL,
  title TEXT NOT NULL,
  mode TEXT NOT NULL CHECK(mode IN ('practice','full')),
  part INTEGER,
  started_at INTEGER NOT NULL,
  deadline_at INTEGER,
  listening_ends_at INTEGER,
  submitted_at INTEGER,
  status TEXT NOT NULL DEFAULT 'active' CHECK(status IN ('active','submitted','expired')),
  content_json TEXT NOT NULL,
  answers_json TEXT NOT NULL DEFAULT '{}',
  flags_json TEXT NOT NULL DEFAULT '[]',
  result_json TEXT
);
CREATE INDEX idx_toeic_attempts_started ON toeic_attempts(started_at DESC);
