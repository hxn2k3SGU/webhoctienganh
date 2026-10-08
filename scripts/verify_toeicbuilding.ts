import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import express from "express";
import request from "supertest";
import { migrate, openDb } from "../backend/src/db";
import { toeicRouter } from "../backend/src/routes/toeic";
import type { ToeicCatalogItem, ToeicTest } from "@lexiloop/shared";

async function main() {
  const directory = path.resolve("backend/data/toeicbuilding");
  const tests = JSON.parse(fs.readFileSync(path.join(directory, "library.json"), "utf8")) as ToeicTest[];
  const db = openDb(":memory:");
  migrate(db);
  const app = express();
  app.use(express.json());
  app.use("/api/toeic", toeicRouter(db, directory));
  let fullTests = 0;
  try {
    const catalog = (await request(app).get("/api/toeic/catalog").expect(200)).body.tests as ToeicCatalogItem[];
    assert.equal(catalog.length, tests.length + 1);
    for (const test of tests) {
      const attempt = (await request(app).post("/api/toeic/attempts").send({ testId: test.id, mode: "practice" }).expect(201)).body;
      assert.equal(attempt.questions.length, test.questions.length);
      assert.ok(attempt.questions.every((q: object) => !("answer" in q) && !("acceptedAnswers" in q) && !("explanation" in q)));
      const first = test.questions[0];
      await request(app).patch(`/api/toeic/attempts/${attempt.id}`).send({ questionId: first.id, choice: first.answer }).expect(200);
      const result = (await request(app).post(`/api/toeic/attempts/${attempt.id}/submit`).expect(200)).body.result;
      assert.equal(result.correct, 1);
      assert.equal(result.total, test.questions.length);
      if (catalog.find(item => item.id === test.id)?.fullAvailable) {
        const full = (await request(app).post("/api/toeic/attempts").send({ testId: test.id, mode: "full" }).expect(201)).body;
        assert.equal(full.questions.length, 100);
        assert.equal(full.deadlineAt - full.listeningEndsAt, 75 * 60000);
        assert.equal(full.listeningEndsAt - full.startedAt, Math.max(2700, test.listeningDurationSeconds ?? 2700) * 1000);
        fullTests++;
      } else {
        await request(app).post("/api/toeic/attempts").send({ testId: test.id, mode: "full" }).expect(400);
      }
    }
    const audio = tests.find(test => test.listeningAudioUrl)!.listeningAudioUrl!;
    const range = await request(app).get(audio).set("Range", "bytes=0-127").expect(206);
    assert.match(range.headers["content-type"], /audio/);
    const image = tests[0].questions.find(q => q.imageUrl)!.imageUrl!;
    assert.match((await request(app).get(image).expect(200)).headers["content-type"], /image/);
    await request(app).get("/api/toeic/media/session.cookies").expect(404);
    console.log(JSON.stringify({ tests: tests.length, questions: tests.reduce((n, t) => n + t.questions.length, 0), fullTests, practiceOnly: tests.length - fullTests, verified: ["catalog", "all test attempts", "answer privacy", "scoring", "full timing", "audio ranges", "images"] }, null, 2));
  } finally {
    db.close();
  }
}

main().catch(error => { console.error(error); process.exitCode = 1; });
