import { Router } from "express";
import type { DB } from "../db";

/**
 * Tính tiến độ học: chuỗi ngày học, chuỗi dài nhất, số từ đã thuộc và huy hiệu.
 * Mở khóa và lưu các huy hiệu mới đạt được.
 */
export function learningProgress(db: DB) {
  const days = (db.prepare("SELECT DISTINCT date(reviewed_at,'localtime') day FROM reviews UNION SELECT DISTINCT date(studied_at,'localtime') day FROM quiz_activity ORDER BY day").all() as { day: string }[]).map(row => row.day);
  const today = (db.prepare("SELECT date('now','localtime') day").get() as { day: string }).day;
  /** Đổi ngày dạng `YYYY-MM-DD` thành số ngày kể từ epoch để so sánh ngày liên tiếp. */
  const dayNumber = (day: string) => Date.parse(day + 'T00:00:00Z') / 86400000;
  let longest = 0, run = 0, previous = -Infinity;
  for (const day of days) { const current = dayNumber(day); run = current === previous + 1 ? run + 1 : 1; longest = Math.max(longest, run); previous = current; }
  const streak = previous >= dayNumber(today) - 1 ? run : 0;
  const learned = (db.prepare("SELECT COUNT(DISTINCT card_id) count FROM reviews WHERE rating IN ('good','easy')").get() as { count: number }).count;
  const definitions = [
    ...[1, 10, 50, 100, 250, 500].map((target, index) => ({ id: `words-${target}`, title: ['Bước đầu tiên', 'Người khám phá', 'Người sưu tầm', 'Kho từ phong phú', 'Bậc thầy từ vựng', 'Thư viện sống'][index], kind: 'words', target, value: learned })),
    ...[3, 7, 14, 30, 100].map((target, index) => ({ id: `streak-${target}`, title: ['Giữ nhịp', 'Một tuần bền bỉ', 'Thói quen vững vàng', 'Ngọn lửa tháng', 'Trăm ngày kiên trì'][index], kind: 'streak', target, value: longest }))
  ];
  const insert = db.prepare("INSERT OR IGNORE INTO achievements(id) VALUES (?)");
  db.transaction(() => { for (const item of definitions) if (item.value >= item.target) insert.run(item.id); })();
  const unlocked = new Map((db.prepare("SELECT id,unlocked_at FROM achievements").all() as { id: string; unlocked_at: string }[]).map(row => [row.id, row.unlocked_at]));
  return { streak, longest, learned, studiedToday: days.includes(today), days: days.slice(-365), achievements: definitions.map(item => ({ ...item, unlockedAt: unlocked.get(item.id) ?? null })) };
}
/** Router `/api/progress`: trả tiến độ học và huy hiệu. */
export function progressRouter(db: DB) {
  const router = Router();
  /** Trả tiến độ học hiện tại. */
  router.get('/', (_req, res) => res.json(learningProgress(db)));
  return router;
}
