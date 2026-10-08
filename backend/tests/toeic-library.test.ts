import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, expect, it } from "vitest";
import request from "supertest";
import { toeicImportSchema, toeicParts } from "@lexiloop/shared";
import { createApp } from "../src/app";
import { openDb, migrate, type DB } from "../src/db";

let directory: string | undefined;
let db: DB | undefined;
let app: ReturnType<typeof createApp> | undefined;
const origin = "http://localhost:5173";
const mediaName = `${"a".repeat(64)}.mp3`;
const audio = `/api/toeic/media/${mediaName}`;
const photo = `/api/toeic/media/${"b".repeat(64)}.png`;

function setup() {
  directory = fs.mkdtempSync(path.join(os.tmpdir(), "toeic-library-"));
  db = openDb(path.join(directory, "app.db")); migrate(db);
  const library = path.join(directory, "toeicbuilding");
  fs.mkdirSync(path.join(library, "media"), { recursive: true });
  fs.writeFileSync(path.join(library, "media", mediaName), "ID3audio-fixture");
  fs.writeFileSync(path.join(library, "session.cookies"), "private session data");
  let number = 0;
  const document = {
    id: "toeicbuilding-123", kind: "imported", title: "Local test", sourceName: "Test fixture",
    sourceUrl: "https://example.com/test", usagePermission: "Synthetic fixture", listeningAudioUrl: audio,
    questions: toeicParts.flatMap(({ part, count }) => Array.from({ length: count }, () => ({
      id: `q${++number}`, number, part, answer: "A", acceptedAnswers: ["A", "B"],
      prompt: "Question prompt", options: part === 2 ? ["A", "B", "C"] : ["One", "One", "Three", "Four"],
      ...(part <= 4 ? { audioUrl: audio } : {}), ...(part === 1 || part >= 6 ? { imageUrl: photo } : {}),
      explanation: "Private answer explanation",
    }))),
  };
  fs.writeFileSync(path.join(library, "library.json"), JSON.stringify([document]));
  app = createApp(db, { disableAuth: true });
  return { app, document };
}

afterEach(() => {
  app?.locals.closeWorkspaces(); db?.close();
  if (directory) fs.rmSync(directory, { recursive: true, force: true });
  app = undefined; db = undefined; directory = undefined;
});

it("loads local tests, hides all answer keys, and accepts duplicate source options", async () => {
  const { app, document } = setup();
  expect(toeicImportSchema.safeParse(document).success).toBe(true);
  const catalog = (await request(app).get("/api/toeic/catalog").expect(200)).body;
  expect(catalog.tests[1]).toMatchObject({ id: document.id, fullAvailable: true, questionCount: 200 });
  expect(JSON.stringify(catalog)).not.toContain("acceptedAnswers");
  const attempt = (await request(app).post("/api/toeic/attempts").set("Origin", origin)
    .send({ testId: document.id, mode: "practice", part: 6 }).expect(201)).body;
  expect(attempt.questions[0]).toMatchObject({ number: 131, imageUrl: photo });
  expect(JSON.stringify(attempt)).not.toContain("acceptedAnswers");
  expect(JSON.stringify(attempt)).not.toContain("Private answer explanation");
  await request(app).patch(`/api/toeic/attempts/${attempt.id}`).set("Origin", origin)
    .send({ questionId: "q131", choice: "B" }).expect(200);
  const result = (await request(app).post(`/api/toeic/attempts/${attempt.id}/submit`).set("Origin", origin).expect(200)).body.result;
  expect(result.correct).toBe(1);
  expect(result.questions[0].acceptedAnswers).toEqual(["A", "B"]);
});

it("supports audio ranges and refuses session files and unauthenticated downloads", async () => {
  const { app } = setup();
  const response = await request(app).get(audio).set("Range", "bytes=0-2").expect(206);
  expect(response.headers["content-range"]).toBe("bytes 0-2/16");
  await request(app).get("/api/toeic/media/session.cookies").expect(404);
  await request(app).get(`/api/toeic/media/${"a".repeat(64)}.html`).expect(404);
  app.locals.closeWorkspaces();
  const locked = createApp(db!, { disableAuth: false });
  await request(locked).get(audio).expect(401);
  locked.locals.closeWorkspaces();
});

it("keeps every second of longer source audio and preserves 75 minutes for Reading", async () => {
  const { app, document } = setup();
  fs.writeFileSync(path.join(directory!, "toeicbuilding", "library.json"), JSON.stringify([{ ...document, listeningDurationSeconds: 2855 }]));
  const attempt = (await request(app).post("/api/toeic/attempts").set("Origin", origin)
    .send({ testId: document.id, mode: "full" }).expect(201)).body;
  expect(attempt.listeningEndsAt - attempt.startedAt).toBe(2855000);
  expect(attempt.deadlineAt - attempt.listeningEndsAt).toBe(75 * 60000);
  expect(attempt.questions).toHaveLength(100);
});
