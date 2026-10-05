import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import request from "supertest";
import { migrate, openDb, type DB } from "../src/db";
import { blankSentence, clozePrompts } from "../src/services/cloze";
import { loadConfig } from "../src/config";
import { createApp } from "../src/app";
import { normalizeRows } from "../src/services/importExport";

let db: DB;
const config = { GEMINI_API_KEY: "mock-only-key", GEMINI_MODEL: "mock-flash" };
const sentence = "We took the train to the airport yesterday.";
const rows = () => db.prepare("SELECT * FROM cards ORDER BY id").all() as any[];
function add(word = "airport", example: string | null = null) {
  db.prepare("INSERT INTO cards(word,meaning,example,topic) VALUES (?,?,?,'travel')").run(word, "sân bay", example);
}
const response = (sentences: unknown) => ({ ok: true, status: 200, json: async () => ({ candidates: [{ content: { parts: [{ text: JSON.stringify({ sentences }) }] } }] }) });
beforeEach(() => { db = openDb(":memory:"); migrate(db); vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("Unexpected network call"))); });
afterEach(() => { db.close(); vi.useRealTimers(); vi.unstubAllGlobals(); });

describe("cloze validation", () => {
  it.each([
    ["art", "The artist showed us a painting.", false],
    ["art", "We study art and admire art every day.", false],
    ["art", "Complete the word: art", false],
    ["art", "art", false],
    ["art", "We study ART at school every day.", true],
    ["take off", "Please take off your coat before dinner.", true],
    ["C++", "She writes C++ programs at work every day.", true],
    ["a.b", "We use axb for our project today.", false],
    ["café", "We visited the café near the station.", true],
    ["art", "We study éart at school every day.", false],
    ["art", "We study arté at school every day.", false],
    ["art", "We study art\u0301 at school every day.", false]
  ])("validates %s in %s", (word, text, valid) => expect(!!blankSentence(word, text)).toBe(valid));
  it("imports the documented example_sentence alias", () => expect(normalizeRows([{ word: "airport", meaning: "sân bay", example_sentence: sentence }]).rows[0].example).toBe(sentence));
});

describe("isolated generation", () => {
  it("prefers valid examples without a key or network", async () => {
    add("airport", sentence);
    expect((await clozePrompts(db, rows(), { GEMINI_MODEL: "mock" })).get(1)).toContain("_____");
    expect(fetch).not.toHaveBeenCalled();
  });
  it("reports missing key without network and permits partial cached questions", async () => {
    add();
    await expect(clozePrompts(db, rows(), { GEMINI_MODEL: "mock" })).rejects.toMatchObject({ code: "GEMINI_KEY_MISSING" });
    add("train", sentence);
    expect((await clozePrompts(db, rows(), { GEMINI_MODEL: "mock" })).size).toBe(1);
    expect(fetch).not.toHaveBeenCalled();
  });
  it("requests structured JSON, persists empty examples and reuses cache", async () => {
    add(); vi.mocked(fetch).mockResolvedValue(response([{ id: 1, sentence }]) as Response);
    await clozePrompts(db, rows(), config); await clozePrompts(db, rows(), config);
    expect(fetch).toHaveBeenCalledTimes(1);
    const body = JSON.parse(vi.mocked(fetch).mock.calls[0][1]!.body as string);
    expect(body.generationConfig).toMatchObject({ responseMimeType: "application/json", responseSchema: { type: "OBJECT" } });
    expect(rows()[0].example).toBe(sentence);
  });
  it("never overwrites invalid existing examples", async () => {
    add("airport", "my own draft"); vi.mocked(fetch).mockResolvedValue(response([{ id: 1, sentence }]) as Response);
    expect((await clozePrompts(db, rows(), config)).size).toBe(1);
    expect(rows()[0].example).toBe("my own draft");
  });
  it("deduplicates concurrent requests and prefers an edit made in flight", async () => {
    add(); let release!: (r: Response) => void;
    vi.mocked(fetch).mockImplementation(() => new Promise(resolve => { release = resolve; }));
    const a = clozePrompts(db, rows(), config), b = clozePrompts(db, rows(), config);
    const edited = "The airport is very busy this morning.";
    db.prepare("UPDATE cards SET example=? WHERE id=1").run(edited);
    release(response([{ id: 1, sentence }]) as Response);
    expect((await a).get(1)).toBe(blankSentence("airport", edited)); await b;
    expect(fetch).toHaveBeenCalledTimes(1); expect(rows()[0].example).toBe(edited);
  });
  it("does not save after the vocabulary changes or is deleted", async () => {
    add(); vi.mocked(fetch).mockImplementation(async () => { db.prepare("UPDATE cards SET word='station' WHERE id=1").run(); return response([{ id: 1, sentence }]) as Response; });
    await expect(clozePrompts(db, rows(), config)).rejects.toMatchObject({ code: "CLOZE_UNAVAILABLE" });
    expect(rows()[0].example).toBeNull();
  });
  it("scopes in-flight deduplication to the database", async () => {
    const other = openDb(":memory:"); migrate(other); add();
    other.prepare("INSERT INTO cards(word,meaning,topic) VALUES ('airport','sân bay','travel')").run();
    vi.mocked(fetch).mockResolvedValue(response([{ id: 1, sentence }]) as Response);
    try { await Promise.all([clozePrompts(db, rows(), config), clozePrompts(other, other.prepare("SELECT * FROM cards").all() as any[], config)]); expect(fetch).toHaveBeenCalledTimes(2); }
    finally { other.close(); }
  });
  it("bounds batches to five items", async () => {
    for (let i = 0; i < 12; i++) add(`word${i}`);
    vi.mocked(fetch).mockImplementation(async (_url, init) => {
      const text = JSON.parse(init!.body as string).contents[0].parts[0].text;
      const cards = JSON.parse(text.split("Vocabulary: ")[1]); expect(cards.length).toBeLessThanOrEqual(5);
      return response(cards.map((c: any) => ({ id: c.id, sentence: `We practice ${c.word} in our class today.` }))) as Response;
    });
    expect((await clozePrompts(db, rows(), config)).size).toBe(12); expect(fetch).toHaveBeenCalledTimes(3);
  });
  it("times out even when the fetch mock ignores abort and clears dedup state", async () => {
    vi.useFakeTimers(); add(); vi.mocked(fetch).mockImplementation(() => new Promise(() => {}));
    const task = expect(clozePrompts(db, rows(), config, { timeoutMs: 50 })).rejects.toMatchObject({ code: "GEMINI_TIMEOUT" });
    await vi.advanceTimersByTimeAsync(50); await task;
    expect((vi.mocked(fetch).mock.calls[0][1]!.signal as AbortSignal).aborted).toBe(true);
    vi.mocked(fetch).mockResolvedValue(response([{ id: 1, sentence }]) as Response);
    expect((await clozePrompts(db, rows(), config)).size).toBe(1);
  });
  it.each([429, 403, 500])("maps HTTP %s without leaking upstream errors", async status => {
    add(); vi.mocked(fetch).mockResolvedValue({ ok: false, status } as Response);
    await expect(clozePrompts(db, rows(), config)).rejects.toMatchObject({ code: status === 429 ? "GEMINI_QUOTA" : status === 403 ? "GEMINI_KEY_INVALID" : "CLOZE_UNAVAILABLE" });
  });
  it("rejects invalid, duplicate and unrelated output while retaining valid items", async () => {
    add(); add("train"); add("station");
    vi.mocked(fetch).mockResolvedValue(response([{ id: 1, sentence }, { id: 2, sentence }, { id: 2, sentence }, { id: 3, sentence: "station" }, { id: 999, sentence }]) as Response);
    expect([...(await clozePrompts(db, rows(), config)).keys()]).toEqual([1]);
    expect(rows()[1].example).toBeNull();
  });
  it("returns a controlled error for malformed JSON", async () => {
    add(); vi.mocked(fetch).mockResolvedValue({ ok: true, status: 200, json: async () => { throw new SyntaxError("private upstream data"); } } as unknown as Response);
    await expect(clozePrompts(db, rows(), config)).rejects.toMatchObject({ code: "CLOZE_UNAVAILABLE" });
  });
});

describe("cloze API", () => {
  const app = (key?: string) => createApp(db, { config: loadConfig({ NODE_ENV: "test", GEMINI_API_KEY: key, GEMINI_MODEL: "mock-flash" }) });
  it("returns server blanks and meaning hint, with unchanged scoring", async () => {
    add(); vi.mocked(fetch).mockResolvedValue(response([{ id: 1, sentence }]) as Response);
    const server = app("mock-only-key");
    const quiz = await request(server).get("/api/quiz?type=cloze").expect(200);
    expect(quiz.body.questions[0]).toMatchObject({ prompt: "We took the train to the _____ yesterday.", answer: "airport", meaningHint: "sân bay" });
    const result = await request(server).post("/api/quiz/submit").set("Origin","http://localhost:5173").send({ sessionId: quiz.body.sessionId, answers: [{ questionId: quiz.body.questions[0].id, answer: "airport", revealedHintPositions: [0] }] }).expect(200);
    expect(result.body.points).toBe(86);
  });
  it("returns Vietnamese configuration error and no empty successful quiz", async () => {
    add(); const result = await request(app()).get("/api/quiz?type=cloze").expect(503);
    expect(result.body).toMatchObject({ error: "GEMINI_KEY_MISSING", message: expect.stringContaining("Chưa cấu hình") });
    expect(fetch).not.toHaveBeenCalled();
  });
  it("returns partial valid questions on quota errors", async () => {
    add("airport", sentence); add("station"); vi.mocked(fetch).mockResolvedValue({ ok: false, status: 429 } as Response);
    const result = await request(app("mock-only-key")).get("/api/quiz?type=cloze").expect(200);
    expect(result.body.questions).toHaveLength(1);
  });
  it("handles an empty vocabulary with a non-success response", async () => {
    await request(app()).get("/api/quiz?type=cloze").expect(502);
    expect(fetch).not.toHaveBeenCalled();
  });
});
