import { randomUUID } from "node:crypto";
import path from "node:path";
import { Router } from "express";
import { z } from "zod";
import { toeicChoiceSchema, toeicImportSchema, toeicParts, type ToeicAttempt, type ToeicCatalogItem, type ToeicChoice, type ToeicResult, type ToeicTest } from "@lexiloop/shared";
import type { DB } from "../db";
import { officialToeicSample } from "../services/toeicSamples";
import { toeicLibrary } from "../services/toeicLibrary";
import { withToeicScore } from "../services/toeicScoring";

type AttemptRow = {
  id: string; test_id: string; title: string; mode: "practice" | "full"; part: number | null;
  started_at: number; deadline_at: number | null; listening_ends_at: number | null;
  submitted_at: number | null; status: "active" | "submitted" | "expired";
  content_json: string; answers_json: string; flags_json: string; result_json: string | null;
};
const startSchema = z.object({
  testId: z.string().min(1).max(100), mode: z.enum(["practice", "full"]),
  part: z.number().int().min(1).max(7).optional(),
  timeLimitMinutes: z.number().int().min(1).max(180).optional(),
}).strict();
const saveSchema = z.object({
  questionId: z.string().min(1).max(100), choice: toeicChoiceSchema.nullable().optional(), flagged: z.boolean().optional(),
}).strict().refine(value => value.choice !== undefined || value.flagged !== undefined);

function catalog(test: ToeicTest): ToeicCatalogItem {
  return { id: test.id, title: test.title, kind: test.kind, sourceName: test.sourceName, sourceUrl: test.sourceUrl,
    listeningAudioUrl: test.listeningAudioUrl, listeningDurationSeconds: test.listeningDurationSeconds, questionCount: test.questions.length,
    partCounts: Object.fromEntries(toeicParts.map(({ part }) => [part, test.questions.filter(q => q.part === part).length])),
    fullAvailable: test.kind === "imported" && test.questions.length === 200 && !!test.listeningAudioUrl &&
      toeicParts.every(({ part, count }) => test.questions.filter(q => q.part === part).length === count) &&
      test.questions.every((question, index) => question.number === index + 1) };
}
function score(test: ToeicTest, answers: Record<string, ToeicChoice>): ToeicResult {
  const questions = test.questions.map(question => ({ ...question, selected: answers[question.id] ?? null, correct: (question.acceptedAnswers ?? [question.answer]).includes(answers[question.id]) }));
  const count = (items: typeof questions) => ({ correct: items.filter(q => q.correct).length, total: items.length });
  const { correct, total } = count(questions);
  return { correct, total, unanswered: questions.filter(q => q.selected === null).length,
    percentage: total ? Math.round(correct * 100 / total) : 0,
    listening: count(questions.filter(q => q.part <= 4)), reading: count(questions.filter(q => q.part >= 5)),
    parts: toeicParts.map(({ part }) => ({ part, ...count(questions.filter(q => q.part === part)) })).filter(part => part.total > 0), questions };
}

export function toeicRouter(db: DB, libraryDirectory?: string) {
  const router = Router();
  const library = toeicLibrary(libraryDirectory);
  const findTest = (id: string): ToeicTest | undefined => {
    if (id === officialToeicSample.id) return officialToeicSample;
    const local = library().find(test => test.id === id);
    if (local) return local;
    const row = db.prepare("SELECT document FROM toeic_tests WHERE id=?").get(id) as { document: string } | undefined;
    return row ? JSON.parse(row.document) : undefined;
  };
  const finish = (row: AttemptRow, status: "submitted" | "expired", now: number) => {
    const result = withToeicScore(score(JSON.parse(row.content_json), JSON.parse(row.answers_json)), row.started_at, status === "expired" ? row.deadline_at! : now);
    db.prepare("UPDATE toeic_attempts SET status=?,submitted_at=?,result_json=? WHERE id=? AND status='active'")
      .run(status, status === "expired" ? row.deadline_at : now, JSON.stringify(result), row.id);
  };
  const read = (id: string, now = Date.now()): AttemptRow | undefined => {
    let row = db.prepare("SELECT * FROM toeic_attempts WHERE id=?").get(id) as AttemptRow | undefined;
    if (row?.status === "active" && row.deadline_at !== null && now >= row.deadline_at) {
      finish(row, "expired", now);
      row = db.prepare("SELECT * FROM toeic_attempts WHERE id=?").get(id) as AttemptRow;
    }
    return row;
  };
  const serialize = (row: AttemptRow, now = Date.now()): ToeicAttempt => {
    const test = JSON.parse(row.content_json) as ToeicTest;
    const section = row.status !== "active" ? "finished" : row.mode === "practice" ? "practice" : now < row.listening_ends_at! ? "Listening" : "Reading";
    return { id: row.id, testId: row.test_id, title: row.title, mode: row.mode, part: row.part,
      startedAt: row.started_at, deadlineAt: row.deadline_at, listeningEndsAt: row.listening_ends_at, submittedAt: row.submitted_at,
      serverNow: now, status: row.status, section, sourceName: test.sourceName, sourceUrl: test.sourceUrl,
      listeningAudioUrl: test.listeningAudioUrl,
      questions: test.questions.filter(q => section === "Listening" ? q.part <= 4 : section === "Reading" ? q.part >= 5 : true)
        .map(({ answer: _answer, acceptedAnswers: _acceptedAnswers, explanation: _explanation, ...question }) => question),
      answers: JSON.parse(row.answers_json), flags: JSON.parse(row.flags_json), result: row.result_json ? withToeicScore(JSON.parse(row.result_json), row.started_at, row.submitted_at!) : null };
  };

  router.get("/media/:name", (req, res) => {
    if (!libraryDirectory || !/^[a-f0-9]{64}\.(?:mp3|wav|ogg|png|jpg|jpeg|webp|gif)$/.test(req.params.name)) return res.sendStatus(404);
    res.set("Cache-Control", "private, max-age=86400");
    res.sendFile(req.params.name, { root: path.resolve(libraryDirectory, "media"), dotfiles: "deny" });
  });
  router.get("/catalog", (_req, res) => {
    const imported = (db.prepare("SELECT document FROM toeic_tests ORDER BY created_at DESC").all() as { document: string }[]).map(row => JSON.parse(row.document) as ToeicTest);
    res.json({ tests: [officialToeicSample, ...library(), ...imported].map(catalog), parts: toeicParts });
  });
  router.post("/tests", (req, res) => {
    const parsed = toeicImportSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ message: "Đề chưa hợp lệ: cần đủ 200 câu, đúng thứ tự 7 Part, đáp án và audio Listening.", issues: parsed.error.issues });
    const test: ToeicTest = { ...parsed.data, id: randomUUID(), kind: "imported" };
    db.prepare("INSERT INTO toeic_tests(id,document,created_at) VALUES (?,?,?)").run(test.id, JSON.stringify(test), Date.now());
    res.status(201).json(catalog(test));
  });
  router.get("/attempts", (_req, res) => {
    const now = Date.now();
    const overdue = db.prepare("SELECT id FROM toeic_attempts WHERE status='active' AND deadline_at<=?").all(now) as { id: string }[];
    for (const row of overdue) read(row.id, now);
    const rows = db.prepare("SELECT * FROM toeic_attempts ORDER BY started_at DESC LIMIT 100").all() as AttemptRow[];
    res.json(rows.map(row => {
      const result = row.result_json ? withToeicScore(JSON.parse(row.result_json), row.started_at, row.submitted_at!) : null;
      return { id: row.id, title: row.title, mode: row.mode, part: row.part, startedAt: row.started_at,
        submittedAt: row.submitted_at, status: row.status, correct: result?.correct ?? null, scaledScore: result?.scaledScore ?? null,
        total: (JSON.parse(row.content_json) as ToeicTest).questions.length };
    }));
  });
  router.post("/attempts", (req, res) => {
    const parsed = startSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ message: "Cấu hình lượt làm bài không hợp lệ." });
    const input = parsed.data, test = findTest(input.testId);
    if (!test) return res.status(404).json({ message: "Không tìm thấy đề thi." });
    if (input.mode === "full" && (!catalog(test).fullAvailable || input.part !== undefined || input.timeLimitMinutes !== undefined)) {
      return res.status(400).json({ message: "Thi thử cần đề đủ 200 câu và audio; thời gian Listening theo đề, Reading 75 phút." });
    }
    const questions = input.mode === "practice" && input.part ? test.questions.filter(q => q.part === input.part) : test.questions;
    if (!questions.length) return res.status(400).json({ message: "Part này chưa có câu hỏi." });
    const now = Date.now(), id = randomUUID();
    const listeningDuration = Math.max(45 * 60000, (test.listeningDurationSeconds ?? 2700) * 1000);
    const deadline = input.mode === "full" ? now + listeningDuration + 75 * 60000 : input.timeLimitMinutes ? now + input.timeLimitMinutes * 60000 : null;
    db.prepare(`INSERT INTO toeic_attempts(id,test_id,title,mode,part,started_at,deadline_at,listening_ends_at,content_json)
      VALUES (?,?,?,?,?,?,?,?,?)`).run(id, test.id, test.title, input.mode, input.part ?? null, now, deadline,
        input.mode === "full" ? now + listeningDuration : null, JSON.stringify({ ...test, questions }));
    res.status(201).json(serialize(read(id, now)!, now));
  });
  router.get("/attempts/:id", (req, res) => {
    const row = read(req.params.id);
    if (!row) return res.status(404).json({ message: "Không tìm thấy lượt làm bài." });
    res.json(serialize(row));
  });
  router.patch("/attempts/:id", (req, res) => {
    const parsed = saveSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ message: "Đáp án không hợp lệ." });
    const now = Date.now(), row = read(req.params.id, now);
    if (!row) return res.status(404).json({ message: "Không tìm thấy lượt làm bài." });
    if (row.status !== "active") return res.status(409).json({ message: "Lượt làm bài đã kết thúc." });
    const question = (JSON.parse(row.content_json) as ToeicTest).questions.find(q => q.id === parsed.data.questionId);
    if (!question || (question.part === 2 && parsed.data.choice === "D")) return res.status(400).json({ message: "Câu hỏi hoặc lựa chọn không hợp lệ." });
    if (row.mode === "full" && (now < row.listening_ends_at! ? question.part > 4 : question.part <= 4)) {
      return res.status(409).json({ message: "Chỉ được trả lời trong phần thi hiện tại." });
    }
    const answers = JSON.parse(row.answers_json) as Record<string, ToeicChoice>, flags = new Set<string>(JSON.parse(row.flags_json));
    if (parsed.data.choice === null) delete answers[question.id];
    else if (parsed.data.choice !== undefined) answers[question.id] = parsed.data.choice;
    if (parsed.data.flagged === true) flags.add(question.id);
    else if (parsed.data.flagged === false) flags.delete(question.id);
    db.prepare("UPDATE toeic_attempts SET answers_json=?,flags_json=? WHERE id=?").run(JSON.stringify(answers), JSON.stringify([...flags]), row.id);
    res.json(serialize(read(row.id, now)!, now));
  });
  router.post("/attempts/:id/submit", (req, res) => {
    const now = Date.now(), row = read(req.params.id, now);
    if (!row) return res.status(404).json({ message: "Không tìm thấy lượt làm bài." });
    if (row.status === "active") {
      if (row.mode === "full" && now < row.listening_ends_at!) return res.status(409).json({ message: "Hãy hoàn thành phần Listening trước khi nộp bài." });
      finish(row, "submitted", now);
    }
    res.json(serialize(read(row.id, now)!, now));
  });
  return router;
}
