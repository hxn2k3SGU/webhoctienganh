ALTER TABLE users ADD COLUMN workspace TEXT NOT NULL DEFAULT 'private';
UPDATE users SET workspace = 'legacy';
