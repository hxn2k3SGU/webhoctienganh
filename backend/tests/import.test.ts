import { afterEach, beforeEach, describe, expect, it } from "vitest";
import request from "supertest";
import XLSX from "xlsx";
import PDFDocument from "pdfkit";
import { createApp } from "../src/app";
import { migrate, openDb, type DB } from "../src/db";
import { normalizeRows } from "../src/services/importExport";

let db: DB;
beforeEach(() => { db = openDb(":memory:"); migrate(db); });
afterEach(() => db.close());

async function pdfWithText(lines: string[]): Promise<Buffer> {
  const document = new PDFDocument({ margin: 50 });
  const chunks: Buffer[] = [];
  document.on("data", chunk => chunks.push(Buffer.from(chunk)));
  const completed = new Promise<Buffer>(resolve => document.on("end", () => resolve(Buffer.concat(chunks))));
  lines.forEach(line => document.text(line));
  document.end();
  return completed;
}

describe("vocabulary import", () => {
  it("normalizes equivalent CSV/XLSX headers and reports invalid rows", () => {
    const result = normalizeRows([{ Vocabulary: "  resilient ", Definition: "able to recover", Tags: "IELTS;hard", Synonyms: "tough, strong", image_url: "https://example.com/resilient.jpg" }, { word: "", meaning: "missing" }]);
    expect(result.rows[0]).toMatchObject({ word: "resilient", meaning: "able to recover", tag: "IELTS", synonyms: ["tough", "strong"], imageUrl: "https://example.com/resilient.jpg" });
    expect(result.errors).toEqual([expect.objectContaining({ row: 3 })]);
  });

  it("previews a PDF table then commits edited rows", async () => {
    const app = createApp(db), pdf = await pdfWithText(["word | meaning | tag", "serendipity | fortunate discovery | IELTS", "lucid | clear | Academic"]);
    const preview = await request(app).post("/api/vocabulary/import/preview").set("Origin","http://localhost:5173").attach("file", pdf, { filename: "words.pdf", contentType: "application/pdf" });
    expect(preview.status, JSON.stringify(preview.body)).toBe(200);
    expect(preview.body).toMatchObject({ format: "pdf", errors: [], rows: [{ word: "serendipity", meaning: "fortunate discovery", tag: "IELTS" }, { word: "lucid", meaning: "clear", tag: "Academic" }] });
    preview.body.rows[0].meaning = "a pleasant accidental discovery";
    const committed = await request(app).post("/api/vocabulary/import/commit").set("Origin","http://localhost:5173").send({ token: preview.body.token, duplicateStrategy: "skip", rows: preview.body.rows }).expect(201);
    expect(committed.body).toEqual({ imported: 2, updated: 0, skipped: 0, total: 2 });
    expect((db.prepare("SELECT meaning FROM cards WHERE word='serendipity'").get() as any).meaning).toBe("a pleasant accidental discovery");
    await request(app).post("/api/vocabulary/import/commit").set("Origin","http://localhost:5173").send({ token: preview.body.token, rows: preview.body.rows }).expect(404);
  });

  it("uses the same normalization for CSV and XLSX and supports skip/update", async () => {
    const app = createApp(db), csv = Buffer.from("Vocabulary,Definition,Tag\nfocus,attention,Study\n");
    const csvPreview = await request(app).post("/api/vocabulary/import/preview").set("Origin","http://localhost:5173").attach("file", csv, { filename: "words.csv", contentType: "text/csv" }).expect(200);
    await request(app).post("/api/vocabulary/import/commit").set("Origin","http://localhost:5173").send({ token: csvPreview.body.token, rows: csvPreview.body.rows, duplicateStrategy: "skip" }).expect(201);
    const workbook = XLSX.utils.book_new(); XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet([{ word: "focus", meaning: "concentration", tag: "Work" }]), "Words");
    const xlsx = XLSX.write(workbook, { type: "buffer", bookType: "xlsx" });
    const xlsxPreview = await request(app).post("/api/vocabulary/import/preview").set("Origin","http://localhost:5173").attach("file", xlsx, { filename: "words.xlsx", contentType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" }).expect(200);
    const skipped = await request(app).post("/api/vocabulary/import/commit").set("Origin","http://localhost:5173").send({ token: xlsxPreview.body.token, rows: xlsxPreview.body.rows, duplicateStrategy: "skip" }).expect(201);
    expect(skipped.body.skipped).toBe(1);
    const again = await request(app).post("/api/vocabulary/import/preview").set("Origin","http://localhost:5173").attach("file", xlsx, { filename: "words.xlsx", contentType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" }).expect(200);
    const updated = await request(app).post("/api/vocabulary/import/commit").set("Origin","http://localhost:5173").send({ token: again.body.token, rows: again.body.rows, duplicateStrategy: "update" }).expect(201);
    expect(updated.body.updated).toBe(1);
  });

  it("returns meaningful errors for extension, MIME, magic, missing file, and invalid rows", async () => {
    const app = createApp(db);
    expect((await request(app).post("/api/vocabulary/import/preview").set("Origin","http://localhost:5173").expect(400)).body.error).toBe("FILE_REQUIRED");
    expect((await request(app).post("/api/vocabulary/import/preview").set("Origin","http://localhost:5173").attach("file", Buffer.from("x"), { filename: "words.txt", contentType: "text/plain" }).expect(415)).body.error).toBe("UNSUPPORTED_EXTENSION");
    expect((await request(app).post("/api/vocabulary/import/preview").set("Origin","http://localhost:5173").attach("file", Buffer.from("x"), { filename: "words.pdf", contentType: "text/plain" }).expect(415)).body.error).toBe("MIME_MISMATCH");
    expect((await request(app).post("/api/vocabulary/import/preview").set("Origin","http://localhost:5173").attach("file", Buffer.from("not pdf"), { filename: "words.pdf", contentType: "application/pdf" }).expect(415)).body.error).toBe("INVALID_FILE_SIGNATURE");
    const invalid = Buffer.from("word,meaning\n,missing word\n");
    const response = await request(app).post("/api/vocabulary/import/preview").set("Origin","http://localhost:5173").attach("file", invalid, { filename: "bad.csv", contentType: "text/csv" }).expect(422);
    expect(response.body).toMatchObject({ error: "NO_VALID_ROWS", details: [expect.objectContaining({ row: 2 })] });
  });

  it("keeps the original one-step CSV endpoint", async () => {
    const response = await request(createApp(db)).post("/api/vocabulary/import").set("Origin","http://localhost:5173").field("duplicateStrategy", "skip").attach("file", Buffer.from("word,meaning,tag\nlegacy,old endpoint,General\n"), { filename: "legacy.csv", contentType: "text/csv" }).expect(201);
    expect(response.body).toMatchObject({ imported: 1, skipped: 0, errors: [] });
  });
});
