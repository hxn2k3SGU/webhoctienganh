import { expect, it } from "vitest";
import request from "supertest";
import { openDb, migrate } from "../src/db";
import { createApp } from "../src/app";

it("limits every quiz mode and meaning choices to the selected deck", async () => {
  const db = openDb(":memory:"); migrate(db);
  db.exec("INSERT INTO decks(name) VALUES ('Food'),('Travel')");
  const add = db.prepare("INSERT INTO cards(word,meaning,example,topic,deck) VALUES (?,?,?,'daily-life',?)");
  add.run('apple','fruit','I eat an apple every morning.','Food');
  add.run('train','vehicle','We take the train to work.','Travel');
  const app = createApp(db);
  try {
    for (const type of ['meaning','typing','cloze','listening']) {
      const response = await request(app).get(`/api/quiz?type=${type}&deck=Food`).expect(200);
      expect(response.body.questions).toHaveLength(1);
      expect(response.body.questions[0].vocabularyId).toBe('1');
      if (type === 'meaning') expect(response.body.questions[0].options).toEqual(['fruit']);
    }
    expect((await request(app).get('/api/quiz?deck=missing').expect(200)).body.questions).toEqual([]);
    expect((await request(app).get('/api/quiz').expect(200)).body.questions).toHaveLength(2);
  } finally { app.locals.closeWorkspaces(); db.close(); }
});
