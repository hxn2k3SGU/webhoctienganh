import { afterEach, beforeEach, expect, it } from "vitest";
import request from "supertest";
import { toeicParts, type ToeicImport } from "@lexiloop/shared";
import { createApp } from "../src/app";
import { openDb, migrate, type DB } from "../src/db";

let db: DB;
let app: ReturnType<typeof createApp>;
const origin = "http://localhost:5173";
beforeEach(() => { db = openDb(":memory:"); migrate(db); app = createApp(db, { disableAuth: true }); });
afterEach(() => { app.locals.closeWorkspaces(); db.close(); });
const start = (body: object) => request(app).post("/api/toeic/attempts").set("Origin", origin).send(body);
const patch = (id: string, body: object) => request(app).patch(`/api/toeic/attempts/${id}`).set("Origin", origin).send(body);
const submit = (id: string) => request(app).post(`/api/toeic/attempts/${id}/submit`).set("Origin", origin);
const sample = { testId: "iibc-official-samples", mode: "practice" };
function fullFixture(): ToeicImport {
  let number = 0;
  return { title: "Synthetic test fixture", sourceName: "Automated tests", sourceUrl: "https://example.com/test", usagePermission: "Synthetic test data only", listeningAudioUrl: "https://example.com/listening.mp3",
    questions: toeicParts.flatMap(({ part, count }) => Array.from({ length: count }, () => ({
      id: `q${++number}`, number, part, answer: "A" as const,
      ...(part === 1 ? { imageUrl: "https://example.com/test.png" } : {}),
      ...(part >= 3 ? { prompt: "Synthetic test prompt", options: ["One", "Two", "Three", "Four"] } : {}),
      ...(part >= 6 ? { passage: "Synthetic passage for automated tests." } : {}),
    }))) };
}
async function importFull() {
  return (await request(app).post("/api/toeic/tests").set("Origin", origin).send(fullFixture()).expect(201)).body.id as string;
}

it("offers 60 official sample answers, preserves original numbering and hides the answer key", async () => {
  const catalog = (await request(app).get("/api/toeic/catalog").expect(200)).body.tests[0];
  expect(catalog).toMatchObject({ questionCount: 60, fullAvailable: false, kind: "official-sample", partCounts: { 1: 2, 2: 4, 3: 12, 4: 12, 5: 5, 6: 4, 7: 21 } });
  expect(catalog).not.toHaveProperty("questions");
  const attempt = (await start({ ...sample, part: 2 }).expect(201)).body;
  expect(attempt.questions.map((q: { number: number }) => q.number)).toEqual([7,8,9,10]);
  expect(JSON.stringify(attempt)).not.toContain('"answer":');
  expect(attempt.result).toBeNull();
  await patch(attempt.id, { questionId: "iibc-7", choice: "D" }).expect(400);
  await start({ ...sample, mode: "full" }).expect(400);
});

it("saves each answer and flag, resumes after rebuilding the router, and grades once", async () => {
  const attempt = (await start({ ...sample, part: 1 }).expect(201)).body;
  await patch(attempt.id, { questionId: "iibc-1", choice: "A", flagged: true }).expect(200);
  await patch(attempt.id, { questionId: "iibc-2", choice: "B" }).expect(200);
  await patch(attempt.id, { questionId: "iibc-2", choice: null }).expect(200);
  app.locals.closeWorkspaces(); app = createApp(db, { disableAuth: true });
  const restored = (await request(app).get(`/api/toeic/attempts/${attempt.id}`).expect(200)).body;
  expect(restored.answers).toEqual({ "iibc-1": "A" }); expect(restored.flags).toEqual(["iibc-1"]);
  const result = (await submit(attempt.id).expect(200)).body;
  expect(result.result).toMatchObject({ correct: 1, total: 2, unanswered: 1, percentage: 50 });
  expect(result.result.questions[1].answer).toBe("D");
  expect((await submit(attempt.id).expect(200)).body.submittedAt).toBe(result.submittedAt);
  await patch(attempt.id, { questionId: "iibc-2", choice: "D" }).expect(409);
  expect((await request(app).get('/api/toeic/attempts').expect(200)).body[0]).toMatchObject({ correct: 1, total: 2, status: 'submitted' });
});

it("enforces expiry on the server and rejects late answers", async () => {
  const attempt = (await start({ ...sample, part: 5, timeLimitMinutes: 1 }).expect(201)).body;
  await patch(attempt.id, { questionId: "iibc-101", choice: "D" }).expect(200);
  db.prepare("UPDATE toeic_attempts SET deadline_at=? WHERE id=?").run(Date.now() - 1, attempt.id);
  await patch(attempt.id, { questionId: "iibc-102", choice: "C" }).expect(409);
  const expired = (await request(app).get(`/api/toeic/attempts/${attempt.id}`).expect(200)).body;
  expect(expired).toMatchObject({ status: "expired", result: { correct: 1, total: 5, unanswered: 4 } });
});

it("validates full test imports and isolates Listening from Reading", async () => {
  const invalid = fullFixture(); invalid.questions[6].part = 1;
  await request(app).post("/api/toeic/tests").set("Origin", origin).send(invalid).expect(400);
  const unsafe = fullFixture(); unsafe.listeningAudioUrl = "javascript:alert(1)";
  await request(app).post("/api/toeic/tests").set("Origin", origin).send(unsafe).expect(400);
  const testId = await importFull();
  await start({ testId, mode: "full", timeLimitMinutes: 1 }).expect(400);
  const attempt = (await start({ testId, mode: "full" }).expect(201)).body;
  expect(attempt.deadlineAt - attempt.startedAt).toBe(120 * 60000);
  expect(attempt.listeningEndsAt - attempt.startedAt).toBe(45 * 60000);
  expect(attempt.section).toBe("Listening"); expect(attempt.questions).toHaveLength(100);
  await patch(attempt.id, { questionId: "q101", choice: "A" }).expect(409);
  await patch(attempt.id, { questionId: "q1", choice: "A" }).expect(200);
  await submit(attempt.id).expect(409);
  db.prepare("UPDATE toeic_attempts SET listening_ends_at=? WHERE id=?").run(Date.now() - 1, attempt.id);
  const reading = (await request(app).get(`/api/toeic/attempts/${attempt.id}`).expect(200)).body;
  expect(reading.section).toBe("Reading"); expect(reading.questions[0].number).toBe(101);
  await patch(attempt.id, { questionId: "q1", choice: "B" }).expect(409);
  await patch(attempt.id, { questionId: "q101", choice: "A" }).expect(200);
  const result = (await submit(attempt.id).expect(200)).body.result;
  expect(result).toMatchObject({ correct: 2, total: 200, listening: { correct: 1, total: 100 }, reading: { correct: 1, total: 100 } });
});

it("requires authentication and keeps attempts and imported tests private to each account", async () => {
  app.locals.closeWorkspaces(); app = createApp(db, { disableAuth: false });
  await request(app).get('/api/toeic/catalog').expect(401);
  const first = request.agent(app), second = request.agent(app);
  const firstAuth = (await first.post('/api/auth/register').set('Origin', origin).send({ username: 'toeic-owner', password: 'test-password-123' }).expect(200)).body;
  const secondAuth = (await second.post('/api/auth/register').set('Origin', origin).send({ username: 'toeic-other', password: 'test-password-456' }).expect(200)).body;
  const imported = (await first.post('/api/toeic/tests').set('Origin', origin).set('X-CSRF-Token', firstAuth.csrfToken).send(fullFixture()).expect(201)).body;
  const attempt = (await first.post('/api/toeic/attempts').set('Origin', origin).set('X-CSRF-Token', firstAuth.csrfToken).send(sample).expect(201)).body;
  await second.get(`/api/toeic/attempts/${attempt.id}`).expect(404);
  await second.patch(`/api/toeic/attempts/${attempt.id}`).set('Origin', origin).set('X-CSRF-Token', secondAuth.csrfToken).send({ questionId: 'iibc-1', choice: 'A' }).expect(404);
  await second.post('/api/toeic/attempts').set('Origin', origin).set('X-CSRF-Token', secondAuth.csrfToken).send({ testId: imported.id, mode: 'full' }).expect(404);
  expect((await second.get('/api/toeic/attempts').expect(200)).body).toEqual([]);
});

it("stores scaled scores, excludes blanks from incorrect counts and enriches legacy history", async () => {
  const testId = await importFull();
  const attempt = (await start({ testId, mode: 'practice' }).expect(201)).body;
  const answers = Object.fromEntries(Array.from({ length: 200 }, (_, i) => [`q${i + 1}`, i < 80 || (i >= 100 && i < 170) ? 'A' : 'B']));
  delete answers.q200;
  db.prepare('UPDATE toeic_attempts SET answers_json=?,started_at=? WHERE id=?').run(JSON.stringify(answers), Date.now() - 123000, attempt.id);
  const finished = (await submit(attempt.id).expect(200)).body;
  expect(finished.result).toMatchObject({ correct: 150, incorrect: 49, unanswered: 1, scaledScore: { listening: 420, reading: 300, total: 720 } });
  expect(finished.result.elapsedSeconds).toBeGreaterThanOrEqual(123);
  const stored = JSON.parse((db.prepare('SELECT result_json FROM toeic_attempts WHERE id=?').get(attempt.id) as {result_json: string}).result_json);
  expect(stored.scaledScore.total).toBe(720);
  delete stored.scaledScore; delete stored.incorrect; delete stored.elapsedSeconds;
  db.prepare('UPDATE toeic_attempts SET result_json=? WHERE id=?').run(JSON.stringify(stored), attempt.id);
  const restored = (await request(app).get(`/api/toeic/attempts/${attempt.id}`).expect(200)).body;
  expect(restored.result.scaledScore.total).toBe(720);
  expect(restored.submittedAt).toBe(finished.submittedAt);
  expect((await request(app).get('/api/toeic/attempts').expect(200)).body[0].scaledScore.total).toBe(720);
});

it("computes expired attempt time from the deadline, not the time it was reopened", async () => {
  const testId = await importFull();
  const attempt = (await start({ testId, mode: 'practice', timeLimitMinutes: 1 }).expect(201)).body;
  const began = Date.now() - 180000;
  db.prepare('UPDATE toeic_attempts SET started_at=?,deadline_at=? WHERE id=?').run(began, began + 60000, attempt.id);
  const result = (await request(app).get(`/api/toeic/attempts/${attempt.id}`).expect(200)).body.result;
  expect(result).toMatchObject({ elapsedSeconds: 60, incorrect: 0, unanswered: 200, scaledScore: { listening: 5, reading: 5, total: 10 } });
});
