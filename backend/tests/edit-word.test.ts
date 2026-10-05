import { expect, it } from "vitest";
import request from "supertest";
import { openDb, migrate } from "../src/db";
import { createApp } from "../src/app";

it("allows duplicate renames without changing the other card", async () => {
  const db = openDb(":memory:"); migrate(db);
  db.exec("INSERT INTO cards(word,meaning,topic) VALUES ('applaud (v)','clap','daily-life'),('applaud','clap','daily-life')");
  const app = createApp(db);
  try {
    await request(app).put('/api/vocabulary/1').set('Origin', 'http://localhost:5173').send({ word: 'applaud', meaning: 'changed', tag: 'General' }).expect(200);
    expect(db.prepare('SELECT word,meaning FROM cards WHERE id=1').get()).toEqual({ word: 'applaud', meaning: 'changed' });
    expect(db.prepare('SELECT word,meaning FROM cards WHERE id=2').get()).toEqual({ word: 'applaud', meaning: 'clap' });
    const edited = await request(app).put('/api/vocabulary/1').set('Origin', 'http://localhost:5173').send({ word: 'applaud (v)', meaning: 'vỗ tay', partOfSpeech: 'verb', tag: 'General' }).expect(200);
    expect(edited.body).toMatchObject({ meaning: 'vỗ tay', partOfSpeech: 'verb' });
    const sameWord = await request(app).put('/api/vocabulary/2').set('Origin', 'http://localhost:5173').send({ word: 'applaud', meaning: 'tán thưởng', tag: 'General' }).expect(200);
    expect(sameWord.body).toMatchObject({ id: '2', word: 'applaud', meaning: 'tán thưởng' });
    await request(app).put('/api/vocabulary/2').set('Origin', 'http://localhost:5173').send({ word: 'APPLAUD', meaning: 'tán thưởng', tag: 'General' }).expect(200);
    const renamed = await request(app).put('/api/vocabulary/1').set('Origin', 'http://localhost:5173').send({ word: 'clap', meaning: 'vỗ tay', tag: 'General' }).expect(200);
    expect(renamed.body.word).toBe('clap');
  } finally { app.locals.closeWorkspaces(); db.close(); }
});
