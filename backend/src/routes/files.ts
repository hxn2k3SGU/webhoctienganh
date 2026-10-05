import { Router } from "express";
import multer from "multer";
import path from "node:path";
import fs from "node:fs";
import crypto from "node:crypto";
import type { DB } from "../db";
import { exportBuffer, insertCards, parseWorkbook } from "../services/importExport";

const IMAGE_TYPES: Record<string, { extension: string; matches: (buffer: Buffer) => boolean }> = {
  "image/jpeg": { extension: ".jpg", matches: buffer => buffer.subarray(0, 3).equals(Buffer.from([0xff, 0xd8, 0xff])) },
  "image/png": { extension: ".png", matches: buffer => buffer.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) },
  "image/gif": { extension: ".gif", matches: buffer => ["GIF87a", "GIF89a"].includes(buffer.subarray(0, 6).toString("ascii")) },
  "image/webp": { extension: ".webp", matches: buffer => buffer.subarray(0, 4).toString("ascii") === "RIFF" && buffer.subarray(8, 12).toString("ascii") === "WEBP" }
};

/**
 * Router xử lý file: tải ảnh lên, nhập/xuất thẻ theo API cũ.
 * @param uploadDir Thư mục lưu ảnh tải lên.
 */
export function filesRouter(db: DB, uploadDir: string) {
  fs.mkdirSync(uploadDir, { recursive: true });
  const memory = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } });
  const media = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: 5 * 1024 * 1024 },
    fileFilter: (_req, file, callback) => callback(null, Boolean(IMAGE_TYPES[file.mimetype]))
  });
  const router = Router();

  /** Tải lên một ảnh (JPEG, PNG, WebP, GIF) và trả về URL. */
  router.post("/media", media.single("file"), (req, res) => {
    if (!req.file) return res.status(400).json({ error: "A JPEG, PNG, WebP, or GIF image is required" });
    const type = IMAGE_TYPES[req.file.mimetype];
    if (!type?.matches(req.file.buffer)) return res.status(415).json({ error: "Image content does not match its file type" });
    const filename = `${crypto.randomUUID()}${type.extension}`;
    fs.writeFileSync(path.join(uploadDir, filename), req.file.buffer, { flag: "wx" });
    res.status(201).json({ url: `/uploads/${filename}`, mimeType: req.file.mimetype, size: req.file.size });
  });
  /** Nhập thẻ từ file CSV/XLSX. */
  router.post("/import", memory.single("file"), (req, res) => {
    if (!req.file) return res.status(400).json({ error: "File is required" });
    try { const cards = parseWorkbook(req.file.buffer, req.file.originalname); res.status(201).json({ imported: insertCards(db, cards) }); }
    catch (error) { res.status(400).json({ error: (error as Error).message }); }
  });
  /** Xuất toàn bộ thẻ ra file CSV hoặc XLSX. */
  router.get("/export", (req, res) => {
    const type = req.query.format === "xlsx" ? "xlsx" : "csv";
    const data = exportBuffer(db.prepare("SELECT * FROM cards ORDER BY word").all(), type);
    res.type(type === "xlsx" ? "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" : "text/csv").attachment(`cards.${type}`).send(data);
  });
  return router;
}
