import { Router } from "express";
import type { DB } from "../db";

/** Router `/api/decks`: liệt kê các bộ thẻ (deck). */
export function decksRouter(db: DB) {
  const router = Router();
  /** Trả danh sách deck kèm số thẻ trong mỗi deck. */
  router.get("/", (_req, res) => res.json(db.prepare("SELECT d.name, COUNT(c.id) count FROM decks d LEFT JOIN cards c ON c.deck=d.name GROUP BY d.name ORDER BY d.name COLLATE NOCASE").all()));
  return router;
}

/**
 * Kiểm tra tên deck và tạo deck nếu chưa có.
 * @returns Tên deck đã chuẩn hóa, hoặc `null` nếu không chọn deck.
 */
export function ensureDeck(db: DB, value: unknown): string | null {
  if (value === undefined || value === null || value === "") return null;
  if (typeof value !== "string" || !value.trim() || value.trim().length > 100) throw new Error("Invalid deck name");
  const name = value.trim();
  db.prepare("INSERT OR IGNORE INTO decks(name) VALUES (?)").run(name);
  return (db.prepare("SELECT name FROM decks WHERE name=?").get(name) as { name: string }).name;
}
