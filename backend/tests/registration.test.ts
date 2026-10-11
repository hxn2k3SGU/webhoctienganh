import { expect, it } from "vitest";
import request from "supertest";
import { openDb, migrate } from "../src/db";
import { createApp } from "../src/app";
import { resetPassword } from "../src/auth";

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

it("resets a legacy password without replacing the account or study data", async () => {
  const db = openDb(":memory:");
  migrate(db);
  const app = createApp(db, { disableAuth: false });
  const origin = "http://localhost:5173";
  const password = "new-secure-password-123";
  try {
    db.prepare("INSERT INTO users(username,password_hash,workspace) VALUES (?,?,?)")
      .run("legacy-owner", "$argon2id$v=19$m=65536,t=3,p=1$salt$hash", "legacy");
    const before = db.prepare("SELECT id,username,workspace FROM users").get();
    await expect(resetPassword(db, "missing", password)).rejects.toThrow("Account not found");
    await resetPassword(db, "legacy-owner", password);
    expect(db.prepare("SELECT id,username,workspace FROM users").get()).toEqual(before);
    const agent = request.agent(app);
    const login = await agent.post("/api/auth/login").set("Origin", origin).send({ username: "legacy-owner", password }).expect(200);
    await agent.post("/api/cards").set("Origin", origin).set("X-CSRF-Token", login.body.csrfToken)
      .send({ word: "retained", meaning: "kept", topic: "daily-life" }).expect(201);
    await resetPassword(db, "legacy-owner", "another-secure-password");
    expect((db.prepare("SELECT COUNT(*) n FROM refresh_tokens").get() as { n: number }).n).toBe(0);
    await request(app).post("/api/auth/login").set("Origin", origin).send({ username: "legacy-owner", password }).expect(401);
    await agent.post("/api/auth/login").set("Origin", origin).send({ username: "legacy-owner", password: "another-secure-password" }).expect(200);
    expect((await agent.get("/api/vocabulary").expect(200)).body.total).toBe(1);
  } finally { app.locals.closeWorkspaces(); db.close(); }
});
