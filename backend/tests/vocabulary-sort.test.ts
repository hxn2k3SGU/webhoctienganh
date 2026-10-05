import { expect, it } from 'vitest';
import request from 'supertest';
import { openDb, migrate } from '../src/db';
import { createApp } from '../src/app';

it('sorts all vocabulary fields before pagination and safely handles unknown fields', async () => {
  const db = openDb(':memory:'); migrate(db); const app = createApp(db);
  try {
    db.exec("INSERT INTO cards(word,meaning,topic,tag,status) VALUES ('apple','zebra','daily-life','B','mastered'),('Book','alpha','daily-life','A','new'),('cat','middle','daily-life','C','learning')");
    db.exec("INSERT INTO study_views(card_id,source,event_key) VALUES (1,'quiz','1'),(1,'quiz','2'),(3,'flashcard','1')");
    for (const [sort, expected] of Object.entries({ word: [1,2,3], meaning: [2,3,1], tag: [2,1,3], status: [2,3,1], reviewCount: [2,3,1] })) {
      for (const direction of ['asc', 'desc']) {
        const order = direction === 'asc' ? expected : [...expected].reverse();
        const response = await request(app).get(`/api/vocabulary?sort=${sort}&direction=${direction}`).expect(200);
        expect(response.body.data.map((item: { id: string }) => Number(item.id))).toEqual(order);
        const page = await request(app).get(`/api/vocabulary?sort=${sort}&direction=${direction}&pageSize=1&page=2`).expect(200);
        expect(Number(page.body.data[0].id)).toBe(order[1]);
      }
    }
    const filtered = await request(app).get('/api/vocabulary?sort=reviewCount&direction=desc&status=Learning').expect(200);
    expect(filtered.body.data.map((item: { id: string }) => item.id)).toEqual(['3']);
    await request(app).get('/api/vocabulary?sort=__proto__&direction=invalid').expect(200);
  } finally { app.locals.closeWorkspaces(); db.close(); }
});
