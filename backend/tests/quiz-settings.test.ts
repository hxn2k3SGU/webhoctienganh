import { expect, it } from 'vitest';
import request from 'supertest';
import { openDb, migrate } from '../src/db';
import { createApp } from '../src/app';

it('persists quiz length, validates limits, and supports the saved count', async () => {
  const db = openDb(':memory:');
  migrate(db);
  const app = createApp(db);
  try {
    const defaults = (await request(app).get('/api/settings').expect(200)).body;
    expect(defaults.quizQuestionCount).toBe(10);
    await request(app).put('/api/settings').set('Origin', 'http://localhost:5173').send({ ...defaults, quizQuestionCount: 15 }).expect(200);
    const saved = (await request(app).get('/api/settings').expect(200)).body;
    expect(saved.quizQuestionCount).toBe(15);
    for (const count of [0, 51, 1.5]) {
      await request(app).put('/api/settings').set('Origin', 'http://localhost:5173').send({ ...defaults, quizQuestionCount: count }).expect(400);
    }
    const insert = db.prepare("INSERT INTO cards(word,meaning,topic) VALUES (?,?,'daily-life')");
    for (let i = 0; i < 20; i++) insert.run(`word${i}`, `meaning${i}`);
    const quiz = await request(app).get(`/api/quiz?count=${saved.quizQuestionCount}`).expect(200);
    expect(quiz.body.questions).toHaveLength(15);
    const short = await request(app).get('/api/quiz?count=50').expect(200);
    expect(short.body.questions).toHaveLength(20);
  } finally {
    app.locals.closeWorkspaces();
    db.close();
  }
});
