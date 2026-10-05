import { Router } from "express";
import type { DB } from "../db";

/** Router `/api/study/summary`: thống kê nhanh số thẻ mới và thẻ đến hạn. */
export function studySummaryRouter(db: DB) {
  const router = Router();
  /** Trả tổng số thẻ, số thẻ mới, số thẻ đến hạn và thời điểm đến hạn gần nhất (có thể lọc theo deck). */
  router.get('/', (req, res) => {
    const deck = typeof req.query.deck === 'string' ? req.query.deck : '';
    const where = deck ? ' WHERE deck=?' : '';
    const args = deck ? [deck] : [];
    const result = db.prepare(`SELECT COUNT(*) total,
      COALESCE(SUM(status='new'),0) newCount,
      COALESCE(SUM(status!='new' AND julianday(due_at)<=julianday('now')),0) dueCount,
      MIN(CASE WHEN status!='new' AND julianday(due_at)>julianday('now') THEN due_at END) nextDue
      FROM cards${where}`).get(...args);
    res.json(result);
  });
  return router;
}
