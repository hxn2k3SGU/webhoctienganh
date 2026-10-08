import fs from "node:fs";
import path from "node:path";
import { expect, it } from "vitest";
import request from "supertest";
import { createApp } from "../src/app";
import { migrate, openDb } from "../src/db";

it("removes images from an existing database while preserving study and account data", () => {
  const db = openDb(":memory:");
  try {
    db.exec("CREATE TABLE schema_migrations (version TEXT PRIMARY KEY, applied_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP)");
    const directory = path.resolve(__dirname, "../migrations");
    for (const file of fs.readdirSync(directory).filter(file => file.endsWith(".sql") && file < "012_").sort()) {
      db.exec(fs.readFileSync(path.join(directory, file), "utf8"));
      db.prepare("INSERT INTO schema_migrations(version) VALUES (?)").run(file);
    }
    db.exec(`
      INSERT INTO users(username,password_hash,workspace) VALUES ('learner','existing-hash','private');
      INSERT INTO decks(name) VALUES ('Study');
      INSERT INTO cards(word,meaning,topic,image_url,audio_url,deck,status,repetitions,interval_days)
        VALUES ('apple','fruit','daily-life','https://example.com/apple.png','/uploads/apple.mp3','Study','review',5,12);
      INSERT INTO reviews(card_id,rating,idempotency_key,previous_interval,next_interval,reviewed_at)
        VALUES (1,'good','review-event',5,12,'2026-10-01T00:00:00Z');
      INSERT INTO study_views(card_id,source,event_key) VALUES (1,'flashcard','review-event');
    `);
    const snapshot = () => Object.fromEntries(["users", "decks", "cards", "reviews", "study_views"].map(table => [table,
      (db.prepare(`SELECT * FROM ${table}`).all() as Record<string, unknown>[]).map(({ image_url: _image, ...row }) => row)
    ]));
    const before = snapshot();
    migrate(db);
    migrate(db);
    expect(db.pragma("table_info(cards)")).not.toEqual(expect.arrayContaining([expect.objectContaining({ name: "image_url" })]));
    expect(snapshot()).toEqual(before);
    expect(db.pragma("foreign_key_check")).toEqual([]);
    expect(db.pragma("integrity_check", { simple: true })).toBe("ok");
  } finally { db.close(); }
});

it("ignores legacy image fields and no longer provides image search or upload endpoints", async () => {
  const db = openDb(":memory:");
  migrate(db);
  const app = createApp(db, { disableAuth: true });
  try {
    const created = await request(app).post("/api/vocabulary").set("Origin", "http://localhost:5173")
      .send({ word: "apple", meaning: "fruit", tag: "General", imageUrl: "https://example.com/apple.png", audioUrl: "/uploads/apple.mp3" }).expect(201);
    expect(created.body).not.toHaveProperty("imageUrl");
    expect(created.body.audioUrl).toBe("/uploads/apple.mp3");
    const exported = await request(app).get("/api/vocabulary/export?format=csv").expect(200);
    expect(exported.text).not.toContain("imageUrl");
    await request(app).post("/api/images/search").set("Origin", "http://localhost:5173").send({ word: "apple", meaning: "fruit" }).expect(404);
    await request(app).post("/api/media").set("Origin", "http://localhost:5173").expect(404);
  } finally { app.locals.closeWorkspaces(); db.close(); }
});
