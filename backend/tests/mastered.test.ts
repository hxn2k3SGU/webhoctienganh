import { expect, it } from 'vitest';
import request from 'supertest';
import { openDb, migrate } from '../src/db';
import { review } from '../src/services/srs';
import { createApp } from '../src/app';

it('earns mastery, keeps due reviews, and relearns after again', async () => {
  const db = openDb(':memory:'); migrate(db);
  const app = createApp(db);
  try {
    db.exec("INSERT INTO cards(word,meaning,topic) VALUES ('apple','fruit','daily-life')");
    const rate = (rating: 'good' | 'hard' | 'easy' | 'again', key: string) => review(db, { cardId: 1, rating, idempotencyKey: key, reviewedAt: '2020-01-01T00:00:00.000Z' });
    for (let i = 1; i <= 4; i++) expect(rate('good', String(i)).card.status).toBe('review');
    expect(rate('hard', '5').card.status).toBe('mastered');
    expect(rate('hard', '5').card.repetitions).toBe(5);
    expect(rate('easy', '6').card.status).toBe('mastered');
    const queue = await request(app).get('/api/study/queue?mode=daily').expect(200);
    expect(queue.body.cards[0].status).toBe('Mastered');
    expect((await request(app).get('/api/dashboard')).body.mastered).toBe(1);
    const forgotten = rate('again', '7').card;
    expect(forgotten.status).toBe('learning');
    expect(forgotten.repetitions).toBe(0);
    expect(forgotten.dueAt).toBe('2020-01-01T00:10:00.000Z');
    expect((await request(app).get('/api/dashboard')).body.mastered).toBe(0);
    for (let i = 1; i <= 5; i++) expect(rate('good', `retry-${i}`).card.status).toBe(i === 5 ? 'mastered' : 'review');
  } finally { app.locals.closeWorkspaces(); db.close(); }
});
