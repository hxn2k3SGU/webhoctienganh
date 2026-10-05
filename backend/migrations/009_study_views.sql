CREATE TABLE study_views (
  card_id INTEGER NOT NULL REFERENCES cards(id) ON DELETE CASCADE,
  source TEXT NOT NULL CHECK(source IN ('flashcard', 'quiz')),
  event_key TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY(card_id, source, event_key)
);
INSERT INTO study_views(card_id, source, event_key)
SELECT card_id, 'flashcard', idempotency_key FROM reviews;
