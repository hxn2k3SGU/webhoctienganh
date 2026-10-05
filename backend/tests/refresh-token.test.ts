import { afterEach, expect, it, vi } from "vitest";
import request from "supertest";
import { openDb, migrate } from "../src/db";
import { createApp } from "../src/app";
import { loadConfig } from "../src/config";

afterEach(() => vi.useRealTimers());

it("issues a 15 minute access token and a 7 day refresh token stored in the database", async () => {
  const db = openDb(":memory:");
  migrate(db);
  const app = createApp(db, { disableAuth: false, config: loadConfig({ NODE_ENV: "development" }) });
  const agent = request.agent(app);
  const origin = "http://localhost:5173";
  try {
    const login = await agent.post("/api/auth/register").set("Origin", origin).send({ username: "owner", password: "secure-password-123" }).expect(200);
    const cookies = ([] as string[]).concat(login.headers["set-cookie"] ?? []);
    expect(cookies.find(x => x.startsWith("lexiloop_access="))).toMatch(/Max-Age=900;/);
    expect(cookies.find(x => x.startsWith("lexiloop_refresh="))).toMatch(/Max-Age=604800;.*Path=\/api\/auth/);
    const stored = db.prepare("SELECT token_hash tokenHash, expires_at expiresAt FROM refresh_tokens").all() as { tokenHash: string; expiresAt: string }[];
    expect(stored).toHaveLength(1);
    expect(Date.parse(stored[0].expiresAt) - Date.parse(login.body.accessTokenExpiresAt)).toBeCloseTo(7 * 86_400_000 - 15 * 60_000, -4);

    const refreshed = await agent.post("/api/auth/refresh").set("Origin", origin).expect(200);
    expect(refreshed.body.csrfToken).toBe(login.body.csrfToken);
    const rotated = db.prepare("SELECT token_hash tokenHash FROM refresh_tokens").all() as { tokenHash: string }[];
    expect(rotated).toHaveLength(1);
    expect(rotated[0].tokenHash).not.toBe(stored[0].tokenHash);
    await agent.get("/api/vocabulary").expect(200);

    await agent.post("/api/auth/logout").set("Origin", origin).expect(204);
    expect((db.prepare("SELECT COUNT(*) n FROM refresh_tokens").get() as { n: number }).n).toBe(0);
    await agent.post("/api/auth/refresh").set("Origin", origin).expect(401);
  } finally { app.locals.closeWorkspaces(); db.close(); }
});

it("rejects access tokens older than 15 minutes", async () => {
  const db = openDb(":memory:");
  migrate(db);
  const app = createApp(db, { disableAuth: false, config: loadConfig({ NODE_ENV: "development" }) });
  const origin = "http://localhost:5173";
  try {
    const login = await request(app).post("/api/auth/register").set("Origin", origin).send({ username: "owner", password: "secure-password-123" }).expect(200);
    const access = ([] as string[]).concat(login.headers["set-cookie"] ?? []).find(x => x.startsWith("lexiloop_access="))!.split(";")[0];
    await request(app).get("/api/vocabulary").set("Cookie", access).expect(200);
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(Date.now() + 16 * 60_000);
    await request(app).get("/api/vocabulary").set("Cookie", access).expect(401);
  } finally { app.locals.closeWorkspaces(); db.close(); }
});