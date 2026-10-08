import { Router } from "express";
import multer from "multer";
import type { DB } from "../db";
import { exportBuffer, insertCards, parseWorkbook } from "../services/importExport";

/** Router nhập/xuất thẻ theo API cũ. */
export function filesRouter(db: DB) {
  const memory = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } });
  const router = Router();
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
