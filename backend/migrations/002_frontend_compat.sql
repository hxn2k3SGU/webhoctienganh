ALTER TABLE cards ADD COLUMN synonyms TEXT NOT NULL DEFAULT '[]';
ALTER TABLE cards ADD COLUMN tag TEXT NOT NULL DEFAULT 'General';
INSERT OR IGNORE INTO settings(key,value) VALUES ('autoPlayAudio','false'),('showExamplesFirst','true'),('theme','system');
