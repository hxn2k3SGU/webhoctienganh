import { expect, it } from "vitest";
import request from "supertest";
import { openDb, migrate } from "../src/db";
import { createApp } from "../src/app";

it("creates decks with words, reuses names, filters study and moves cards", async () => {
  const db = openDb(":memory:"); migrate(db);
  const app = createApp(db);
  const origin = "http://localhost:5173";
  const word = { word: "apple", meaning: "fruit", tag: "General", deck: "Food" };
  try {
    const created = await request(app).post("/api/vocabulary").set("Origin", origin).send(word).expect(201);
    expect(created.body.deck).toBe("Food");
    await request(app).post("/api/vocabulary").set("Origin", origin).send({ ...word, word: "pear", deck: "food" }).expect(201);
    await request(app).post("/api/vocabulary").set("Origin", origin).send({ ...word, word: "train", deck: "Travel" }).expect(201);
    expect((await request(app).get("/api/decks").expect(200)).body).toEqual([{ name: "Food", count: 2 }, { name: "Travel", count: 1 }]);
    expect((await request(app).get("/api/vocabulary?deck=Food").expect(200)).body.total).toBe(2);
    const queue = await request(app).get("/api/study/queue?mode=new&deck=Travel").expect(200);
    expect(queue.body.cards.map((card: any) => card.word)).toEqual(["train"]);
    await request(app).put(`/api/vocabulary/${created.body.id}`).set("Origin", origin).send({ ...word, deck: "Travel" }).expect(200);
    expect((await request(app).get("/api/vocabulary?deck=Travel").expect(200)).body.total).toBe(2);
    await request(app).put(`/api/vocabulary/${created.body.id}`).set("Origin", origin).send({ ...word, deck: "" }).expect(200);
    expect((await request(app).get("/api/vocabulary?unassigned=true").expect(200)).body.total).toBe(1);
  } finally { app.locals.closeWorkspaces(); db.close(); }
});
