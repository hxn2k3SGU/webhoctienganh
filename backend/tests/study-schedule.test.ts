import { expect, it } from "vitest";
import request from "supertest";
import { openDb, migrate } from "../src/db";
import { createApp } from "../src/app";
import { review } from "../src/services/srs";

it("includes due ISO timestamps and scopes counts and queues to the selected deck", async () => {
  const db = openDb(":memory:"); migrate(db);
  db.exec("INSERT INTO decks(name) VALUES ('A'),('B')");
  const add = db.prepare("INSERT INTO cards(word,meaning,topic,status,due_at,deck) VALUES (?,?,'daily-life',?,?,?)");
  add.run('due', 'due', 'review', new Date(Date.now() - 60000).toISOString(), 'A');
  add.run('later', 'later', 'review', new Date(Date.now() + 3600000).toISOString(), 'A');
  add.run('new', 'new', 'new', new Date().toISOString(), 'A');
  add.run('other', 'other', 'review', new Date(Date.now() - 60000).toISOString(), 'B');
  const app = createApp(db);
  try {
    const summary = await request(app).get('/api/study/summary?deck=A').expect(200);
    expect(summary.body).toMatchObject({ total: 3, dueCount: 1, newCount: 1 });
    const queue = await request(app).get('/api/study/queue?mode=daily&deck=A').expect(200);
    expect(queue.body.cards.map((card: any) => card.word)).toEqual(['due']);
  } finally { app.locals.closeWorkspaces(); db.close(); }
});

it("spaces remembered words and reschedules forgotten words after ten minutes", () => {
  const db = openDb(":memory:"); migrate(db);
  db.exec("INSERT INTO cards(word,meaning,topic) VALUES ('apple','fruit','daily-life')");
  try {
    review(db, { cardId: 1, rating: 'good', idempotencyKey: 'one', reviewedAt: '2026-09-20T10:00:00Z' });
    expect(db.prepare('SELECT interval_days FROM cards').get()).toEqual({ interval_days: 1 });
    review(db, { cardId: 1, rating: 'good', idempotencyKey: 'two', reviewedAt: '2026-09-21T10:00:00Z' });
    expect(db.prepare('SELECT interval_days FROM cards').get()).toEqual({ interval_days: 6 });
    review(db, { cardId: 1, rating: 'again', idempotencyKey: 'three', reviewedAt: '2026-09-27T10:00:00Z' });
    expect(db.prepare('SELECT due_at FROM cards').get()).toEqual({ due_at: '2026-09-27T10:10:00.000Z' });
  } finally { db.close(); }
});
