import { randomUUID } from "node:crypto";
import type { DB } from "../db";
import { ensureDeck } from "../routes/decks";
import XLSX from "xlsx";
import { importRowSchema, type ImportRow } from "@lexiloop/shared";

const pdfjs: { getDocument(input: { data: Uint8Array; disableFontFace: boolean }): { promise: Promise<any> } } = require("pdfjs-dist/legacy/build/pdf.js");

export const MAX_IMPORT_BYTES = 10 * 1024 * 1024;
export const IMPORT_TOKEN_TTL_MS = 15 * 60 * 1000;
export const columns = ["word", "meaning", "example", "pronunciation", "partOfSpeech", "imageUrl", "topic", "tag", "synonyms", "tags"];
export type ImportKind = "csv" | "xlsx" | "pdf";
export interface ImportIssue { row: number; message: string }
export interface ImportPreview { token: string; expiresAt: string; format: ImportKind; rows: ImportRow[]; errors: ImportIssue[] }

const previews = new Map<string, { expiresAt: number; rows: ImportRow[]; owner?: DB }>();
const aliases: Record<string, keyof ImportRow | "tags"> = {
  word: "word", vocabulary: "word", term: "word", english: "word", tu: "word", "tu vung": "word",
  meaning: "meaning", definition: "meaning", vietnamese: "meaning", nghia: "meaning", "y nghia": "meaning",
  example: "example", "example sentence": "example", sentence: "example", pronunciation: "pronunciation", phonetic: "pronunciation",
  "part of speech": "partOfSpeech", partofspeech: "partOfSpeech", pos: "partOfSpeech",
  image: "imageUrl", "image url": "imageUrl", imageurl: "imageUrl",
  synonym: "synonyms", synonyms: "synonyms", tag: "tag", topic: "tag", tags: "tags"
};

/** Chuẩn hóa ô dữ liệu: chuyển sang chuỗi, gộp khoảng trắng thừa. */
function clean(value: unknown): string { return String(value ?? "").replace(/\s+/g, " ").trim(); }
/** Chuẩn hóa tên cột (chữ thường, bỏ dấu) để nhận diện header linh hoạt. */
function key(value: unknown): string {
  return clean(value).toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[_-]+/g, " ");
}
/** Tách giá trị thành danh sách theo dấu `;`, `,` hoặc `|`. */
function list(value: unknown): string[] {
  if (Array.isArray(value)) return value.map(clean).filter(Boolean);
  return clean(value).split(/[;,|]/).map(clean).filter(Boolean);
}
/** Ánh xạ một dòng với tên cột bất kỳ sang các trường chuẩn (word, meaning, example...). */
function normalizeRecord(raw: Record<string, unknown>): unknown {
  const mapped: Record<string, unknown> = {};
  for (const [header, value] of Object.entries(raw)) {
    const field = aliases[key(header)];
    if (field) mapped[field] = value;
  }
  const tags = list(mapped.tags);
  return {
    word: clean(mapped.word), meaning: clean(mapped.meaning), example: clean(mapped.example),
    pronunciation: clean(mapped.pronunciation), partOfSpeech: clean(mapped.partOfSpeech),
    imageUrl: clean(mapped.imageUrl), synonyms: list(mapped.synonyms), tag: clean(mapped.tag) || tags[0] || "General"
  };
}

/**
 * Chuẩn hóa và kiểm tra tất cả các dòng nhập.
 * @returns Các dòng hợp lệ và danh sách lỗi theo số dòng.
 */
export function normalizeRows(rawRows: Record<string, unknown>[]): { rows: ImportRow[]; errors: ImportIssue[] } {
  const rows: ImportRow[] = [], errors: ImportIssue[] = [];
  rawRows.forEach((raw, index) => {
    const parsed = importRowSchema.safeParse(normalizeRecord(raw));
    if (parsed.success) rows.push(parsed.data);
    else errors.push({ row: index + 2, message: parsed.error.issues.map(issue => `${issue.path.join(".")}: ${issue.message}`).join("; ") });
  });
  return { rows, errors };
}

/** Đọc sheet đầu tiên của file CSV/XLSX thành mảng đối tượng. */
function workbookRows(buffer: Buffer, kind: "csv" | "xlsx"): Record<string, unknown>[] {
  const workbook = kind === "csv"
    ? XLSX.read(buffer.toString("utf8").replace(/^\uFEFF/, ""), { type: "string", raw: false })
    : XLSX.read(buffer, { type: "buffer", raw: false });
  const sheet = workbook.Sheets[workbook.SheetNames[0]];
  if (!sheet) throw new ImportError(422, "EMPTY_FILE", "The import file has no worksheet");
  return XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: "" });
}

/** Tách một dòng văn bản PDF thành các cột (theo tab, `|`, dấu gạch, dấu hai chấm hoặc nhiều khoảng trắng). */
function splitPdfLine(line: string): string[] {
  if (line.includes("\t")) return line.split(/\t+/).map(clean);
  if (line.includes("|")) return line.replace(/^\||\|$/g, "").split("|").map(clean);
  return line.split(/\s{2,}/).map(clean);
}
/** Kiểm tra dòng có phải đường kẻ phân cách bảng (`---`) hay không. */
function isSeparator(line: string): boolean { return /^\s*\|?\s*:?-{3,}/.test(line); }
/** Trích xuất văn bản từ file PDF, giữ thứ tự dòng. */
async function extractPdfText(buffer: Buffer): Promise<string> {
  const document = await pdfjs.getDocument({ data: new Uint8Array(buffer), disableFontFace: true }).promise;
  const lines: string[] = [];
  for (let pageNumber = 1; pageNumber <= document.numPages; pageNumber++) {
    const page = await document.getPage(pageNumber), content = await page.getTextContent();
    let currentY: number | undefined, line = "";
    for (const item of content.items as any[]) {
      const y = item.transform?.[5];
      if (currentY !== undefined && y !== currentY) { if (line.trim()) lines.push(line.trim()); line = ""; }
      const value = clean(item.str); if (value) line += `${line ? " " : ""}${value}`;
      currentY = y;
    }
    if (line.trim()) lines.push(line.trim());
  }
  await document.destroy();
  return lines.join("\n");
}
/** Phân tích văn bản PDF thành các dòng từ vựng (dạng bảng có header hoặc danh sách `từ - nghĩa`). */
function parsePdfText(text: string): Record<string, unknown>[] {
  const lines = text.split(/\r?\n/).map(line => line.trim()).filter(line => line && !isSeparator(line));
  if (!lines.length) throw new ImportError(422, "PDF_NO_TEXT", "The PDF contains no extractable text");
  const headerIndex = lines.findIndex(line => splitPdfLine(line).some(cell => aliases[key(cell)] === "word") && splitPdfLine(line).some(cell => aliases[key(cell)] === "meaning"));
  if (headerIndex >= 0) {
    const headers = splitPdfLine(lines[headerIndex]);
    return lines.slice(headerIndex + 1).map(line => splitPdfLine(line)).filter(cells => cells.length >= 2).map(cells => Object.fromEntries(headers.map((header, i) => [header, cells[i] ?? ""])));
  }
  const records: Record<string, unknown>[] = [];
  for (const line of lines) {
    const match = line.match(/^(.{1,120}?)\s*(?:\s[-–—:=]\s|\t|\s{2,})(.+)$/);
    if (match) records.push({ word: match[1], meaning: match[2] });
  }
  if (!records.length) throw new ImportError(422, "PDF_LAYOUT_UNRECOGNIZED", "Could not detect a word/meaning table or list in the PDF");
  return records;
}

export class ImportError extends Error {
  /** @param status Mã HTTP. @param code Mã lỗi. @param details Thông tin thêm (ví dụ danh sách lỗi theo dòng). */
  constructor(public status: number, public code: string, message: string, public details?: unknown) { super(message); }
}
/** Xác định định dạng file nhập (csv, xlsx, pdf) theo đuôi file, MIME type và nội dung; báo lỗi nếu không hỗ trợ. */
export function detectImportKind(file: { originalname: string; mimetype: string; buffer: Buffer; size: number }): ImportKind {
  if (!file.size || !file.buffer.length) throw new ImportError(400, "EMPTY_FILE", "The uploaded file is empty");
  if (file.size > MAX_IMPORT_BYTES) throw new ImportError(413, "FILE_TOO_LARGE", "File exceeds the 10 MB limit");
  const ext = file.originalname.toLowerCase().match(/\.(csv|xlsx|pdf)$/)?.[1] as ImportKind | undefined;
  if (!ext) throw new ImportError(415, "UNSUPPORTED_EXTENSION", "Only .csv, .xlsx, and .pdf files are supported");
  const mime: Record<ImportKind, string[]> = {
    csv: ["text/csv", "application/csv", "text/plain", "application/vnd.ms-excel"],
    xlsx: ["application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", "application/octet-stream"],
    pdf: ["application/pdf", "application/octet-stream"]
  };
  if (!mime[ext].includes(file.mimetype)) throw new ImportError(415, "MIME_MISMATCH", `MIME type ${file.mimetype || "unknown"} does not match .${ext}`);
  const magic = ext === "pdf" ? file.buffer.subarray(0, 5).toString() === "%PDF-" : ext === "xlsx" ? file.buffer.subarray(0, 2).toString() === "PK" : !file.buffer.includes(0);
  if (!magic) throw new ImportError(415, "INVALID_FILE_SIGNATURE", `File content is not a valid ${ext.toUpperCase()} file`);
  return ext;
}
/** Đọc file nhập bất kỳ định dạng hỗ trợ và trả các dòng đã chuẩn hóa kèm lỗi. */
export async function parseImportFile(file: { originalname: string; mimetype: string; buffer: Buffer; size: number }) {
  const format = detectImportKind(file);
  let raw: Record<string, unknown>[];
  try { raw = format === "pdf" ? parsePdfText(await extractPdfText(file.buffer)) : workbookRows(file.buffer, format); }
  catch (error) { if (error instanceof ImportError) throw error; throw new ImportError(422, "PARSE_FAILED", `Could not parse ${format.toUpperCase()} file`, (error as Error).message); }
  const normalized = normalizeRows(raw);
  if (!normalized.rows.length) throw new ImportError(422, "NO_VALID_ROWS", "No valid vocabulary rows were found", normalized.errors);
  return { format, ...normalized };
}
/**
 * Lưu tạm kết quả đọc file trong bộ nhớ và tạo token xem trước (có hạn dùng).
 * @param owner Database của người dùng, để token không dùng được ở tài khoản khác.
 */
export function createPreview(format: ImportKind, rows: ImportRow[], errors: ImportIssue[], owner?: DB): ImportPreview {
  const now = Date.now(); for (const [token, value] of previews) if (value.expiresAt <= now) previews.delete(token);
  const token = randomUUID(), expiresAt = now + IMPORT_TOKEN_TTL_MS;
  previews.set(token, { expiresAt, rows, owner });
  return { token, expiresAt: new Date(expiresAt).toISOString(), format, rows, errors };
}
/** Lấy và hủy bản xem trước theo token; báo lỗi nếu token sai, hết hạn hoặc thuộc người khác. */
export function consumePreview(token: string, owner?: DB): ImportRow[] {
  const preview = previews.get(token);
  if (!preview || preview.owner !== owner) throw new ImportError(404, "IMPORT_TOKEN_NOT_FOUND", "Import preview token was not found");
  if (preview.expiresAt <= Date.now()) { previews.delete(token); throw new ImportError(410, "IMPORT_TOKEN_EXPIRED", "Import preview token has expired"); }
  previews.delete(token); return preview.rows;
}

/**
 * Ghi các dòng từ vựng vào database trong một transaction.
 * @param strategy `skip` bỏ qua từ trùng, `update` cập nhật từ trùng.
 * @param deckName Deck gán cho các từ được nhập.
 * @returns Số từ đã thêm, cập nhật, bỏ qua.
 */
export function commitRows(db: DB, rows: ImportRow[], strategy: "skip" | "update", deckName?: string) {
  let imported = 0, updated = 0, skipped = 0;
  const find = db.prepare("SELECT id FROM cards WHERE word=?");
  const insert = db.prepare(`INSERT INTO cards(word,meaning,example,pronunciation,part_of_speech,topic,image_url,audio_url,tags,synonyms,tag,status) VALUES (@word,@meaning,@example,@pronunciation,@partOfSpeech,@topic,@imageUrl,NULL,@tags,@synonyms,@tag,'new')`);
  const update = db.prepare(`UPDATE cards SET meaning=@meaning,example=@example,pronunciation=@pronunciation,part_of_speech=@partOfSpeech,topic=@topic,image_url=CASE WHEN @imageUrl<>'' THEN @imageUrl ELSE image_url END,tags=@tags,synonyms=@synonyms,tag=@tag,updated_at=CURRENT_TIMESTAMP WHERE word=@word`);
  db.transaction(() => rows.forEach(row => {
    const params = { ...row, example: row.example || null, pronunciation: row.pronunciation || null, partOfSpeech: row.partOfSpeech || null, topic: "work-study", tags: JSON.stringify([row.tag]), synonyms: JSON.stringify(row.synonyms) };
    if (find.get(row.word)) { if (strategy === "skip") { skipped++; return; } else { update.run(params); updated++; } }
    else { insert.run(params); imported++; }
    if (deckName?.trim()) db.prepare("UPDATE cards SET deck=? WHERE word=?").run(ensureDeck(db, deckName), row.word);
  }))();
  return { imported, updated, skipped, total: rows.length };
}

// Backward-compatible parser used by the original one-step import endpoint.
/** Đọc file CSV/XLSX thành các dòng hợp lệ; báo lỗi nếu có dòng không hợp lệ. */
export function parseWorkbook(buffer: Buffer, name: string) {
  const kind = /\.csv$/i.test(name) ? "csv" : "xlsx";
  const rawRows = workbookRows(buffer, kind), result = normalizeRows(rawRows);
  if (result.errors.length) throw new Error(`Row ${result.errors[0].row}: ${result.errors[0].message}`);
  return result.rows.map((row, index) => { const topic = clean(rawRows[index].topic); return { ...row, topic: ["daily-life", "travel", "work-study"].includes(topic) ? topic : "work-study", tags: list(rawRows[index].tags).length ? list(rawRows[index].tags) : [row.tag] }; });
}
/** Thêm danh sách thẻ, bỏ qua thẻ đã có cùng từ (dùng cho seed và API cũ). */
export function insertCards(db: DB, cards: any[]) { return db.transaction(() => { for (const card of cards) { const existing = db.prepare("SELECT id FROM cards WHERE word=? ORDER BY id LIMIT 1").get(card.word) as { id: number } | undefined; const values = [card.meaning, card.example || null, card.pronunciation || null, card.partOfSpeech || null, card.topic, JSON.stringify(card.tags || []), (card.tags || [])[0] || card.topic]; if(existing) db.prepare("UPDATE cards SET meaning=?,example=?,pronunciation=?,part_of_speech=?,topic=?,tags=?,tag=?,updated_at=CURRENT_TIMESTAMP WHERE id=?").run(...values,existing.id); else db.prepare("INSERT INTO cards(meaning,example,pronunciation,part_of_speech,topic,tags,tag,word,image_url,audio_url) VALUES (?,?,?,?,?,?,?,?,?,?)").run(...values,card.word,card.imageUrl??null,card.audioUrl??null); } return cards.length; })(); }
/** Tạo nội dung file CSV hoặc XLSX từ danh sách thẻ. */
export function exportBuffer(rows: any[], type: "csv" | "xlsx") { const data = rows.map(r => ({ word:r.word, meaning:r.meaning, example:r.example||"", pronunciation:r.pronunciation||"", partOfSpeech:r.part_of_speech||"", imageUrl:r.image_url||"", topic:r.topic, tag:r.tag||r.topic, synonyms:JSON.parse(r.synonyms||"[]").join(";"), tags:JSON.parse(r.tags||"[]").join(";") })); const ws=XLSX.utils.json_to_sheet(data,{header:columns}); if(type==="csv")return Buffer.from(XLSX.utils.sheet_to_csv(ws),"utf8"); const wb=XLSX.utils.book_new(); XLSX.utils.book_append_sheet(wb,ws,"Cards"); return XLSX.write(wb,{type:"buffer",bookType:"xlsx"}); }
