import { expect, it } from "vitest";
import request from "supertest";
import { openDb, migrate } from "../src/db";
import { createApp } from "../src/app";

it("registers separate accounts, rejects duplicates and preserves the owner's data", async () => {
  const db = openDb(":memory:");
  migrate(db);
  const app = createApp(db, { disableAuth: false });
  const owner = request.agent(app), member = request.agent(app);
  const origin = "http://localhost:5173";
  try {
    await request(app).post("/api/auth/register").set("Origin", origin).send({ username: "bad", password: "short" }).expect(400);
    const first = await owner.post("/api/auth/register").set("Origin", origin).send({ username: "owner", password: "secure-password-123" }).expect(200);
    await owner.post("/api/cards").set("Origin", origin).set("X-CSRF-Token", first.body.csrfToken).send({ word: "private", meaning: "personal", topic: "daily-life" }).expect(201);
    const second = await member.post("/api/auth/register").set("Origin", origin).send({ username: "member", password: "secure-password-456" }).expect(200);
    expect((await member.get("/api/vocabulary").expect(200)).body.total).toBe(0);
    expect((await owner.get("/api/vocabulary").expect(200)).body.total).toBe(1);
    await member.get("/api/cards/1").expect(404);
    await member.delete("/api/cards/1").set("Origin", origin).set("X-CSRF-Token", second.body.csrfToken).expect(404);
    await request(app).post("/api/auth/register").set("Origin", origin).send({ username: "MEMBER", password: "secure-password-789" }).expect(409);
    await member.post("/api/auth/logout").set("Origin", origin).set("X-CSRF-Token", second.body.csrfToken).expect(204);
    await member.get("/api/auth/session").expect(401);
    await member.post("/api/auth/login").set("Origin", origin).send({ username: "member", password: "secure-password-456" }).expect(200);
    await member.get("/api/auth/session").expect(200);
  } finally { app.locals.closeWorkspaces(); db.close(); }
});
