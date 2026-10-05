import { expect, it } from 'vitest';
import request from 'supertest';
import { openDb, migrate } from '../src/db';
import { createApp } from '../src/app';
import { review } from '../src/services/srs';

it('counts real reviews per word including again without double-counting retries', async () => {
  const db = openDb(':memory:'); migrate(db);
  const app = createApp(db);
  try {
    db.exec("INSERT INTO cards(word,meaning,topic) VALUES ('apple','fruit','daily-life'),('book','reading','daily-life')");
    review(db, { cardId: 1, rating: 'good', idempotencyKey: 'first' });
    review(db, { cardId: 1, rating: 'again', idempotencyKey: 'second' });
    review(db, { cardId: 1, rating: 'again', idempotencyKey: 'second' });
    const response = await request(app).get('/api/vocabulary').expect(200);
    expect(response.body.data.map((word: { reviewCount: number }) => word.reviewCount)).toEqual([2, 0]);
    const filtered = await request(app).get('/api/vocabulary?q=apple&pageSize=1').expect(200);
    expect(filtered.body.total).toBe(1);
    expect(filtered.body.data[0].reviewCount).toBe(2);
  } finally { app.locals.closeWorkspaces(); db.close(); }
});

it('combines visible flashcards and quiz questions without counting ratings twice', async () => {
  const db = openDb(':memory:'); migrate(db);
  const app = createApp(db);
  try {
    db.exec("INSERT INTO cards(word,meaning,topic) VALUES ('apple','fruit','daily-life'),('book','reading','daily-life')");
    for (const source of ['flashcard', 'quiz', 'match', 'memory', 'blocks', 'blast', 'vocabulary']) {
      for (let repeat = 0; repeat < 2; repeat++) {
        await request(app).post('/api/study/view').set('Origin', 'http://localhost:5173')
          .send({ source, sessionId: 'session-1', cardId: '1' }).expect(204);
      }
    }
    await request(app).post('/api/study/review').set('Origin', 'http://localhost:5173')
      .send({ vocabularyId: '1', sessionId: 'session-1', rating: 'good' }).expect(200);
    const response = await request(app).get('/api/vocabulary').expect(200);
    expect(response.body.data.map((word: { reviewCount: number }) => word.reviewCount)).toEqual([7, 0]);
    await request(app).post('/api/study/view').set('Origin', 'http://localhost:5173')
      .send({ source: 'quiz', sessionId: 'session-2', cardId: '1' }).expect(204);
    expect((await request(app).get('/api/vocabulary')).body.data[0].reviewCount).toBe(8);
  } finally { app.locals.closeWorkspaces(); db.close(); }
});
