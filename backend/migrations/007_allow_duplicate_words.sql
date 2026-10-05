CREATE TABLE reviews_backup AS SELECT * FROM reviews;
DROP TABLE reviews;
CREATE TABLE cards_new (
 id INTEGER PRIMARY KEY AUTOINCREMENT, word TEXT NOT NULL COLLATE NOCASE,
 meaning TEXT NOT NULL, example TEXT, pronunciation TEXT, part_of_speech TEXT,
 topic TEXT NOT NULL CHECK(topic IN ('daily-life','travel','work-study')),
 image_url TEXT, audio_url TEXT, tags TEXT NOT NULL DEFAULT '[]',
 status TEXT NOT NULL DEFAULT 'new', ease_factor REAL NOT NULL DEFAULT 2.5,
 interval_days INTEGER NOT NULL DEFAULT 0, repetitions INTEGER NOT NULL DEFAULT 0,
 due_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP, created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
 updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP, synonyms TEXT NOT NULL DEFAULT '[]',
 tag TEXT NOT NULL DEFAULT 'General', deck TEXT REFERENCES decks(name)
);
INSERT INTO cards_new SELECT * FROM cards;
DROP TABLE cards;
ALTER TABLE cards_new RENAME TO cards;
CREATE INDEX idx_cards_due ON cards(status,due_at);
CREATE INDEX idx_cards_topic ON cards(topic);
CREATE INDEX idx_cards_deck ON cards(deck);
CREATE INDEX idx_cards_word ON cards(word);
CREATE TABLE reviews (id INTEGER PRIMARY KEY AUTOINCREMENT, card_id INTEGER NOT NULL REFERENCES cards(id) ON DELETE CASCADE, rating TEXT NOT NULL, idempotency_key TEXT NOT NULL UNIQUE, previous_interval INTEGER NOT NULL, next_interval INTEGER NOT NULL, reviewed_at TEXT NOT NULL);
INSERT INTO reviews SELECT * FROM reviews_backup;
DROP TABLE reviews_backup;
