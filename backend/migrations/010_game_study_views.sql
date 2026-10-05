CREATE TABLE study_views_all (
  card_id INTEGER NOT NULL REFERENCES cards(id) ON DELETE CASCADE,
  source TEXT NOT NULL CHECK(source IN ('flashcard', 'quiz', 'match', 'memory', 'blocks', 'blast', 'vocabulary')),
  event_key TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY(card_id, source, event_key)
);
INSERT INTO study_views_all SELECT card_id, source, event_key, created_at FROM study_views;
DROP TABLE study_views;
ALTER TABLE study_views_all RENAME TO study_views;
