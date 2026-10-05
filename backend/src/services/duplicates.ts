import type { DB } from '../db';

/**
 * Tìm các nhóm thẻ trùng nhau (cùng từ và nghĩa).
 * Trong mỗi nhóm, thẻ được ôn gần nhất đứng đầu.
 * @returns Danh sách nhóm id thẻ.
 */
export function duplicateGroups(db: DB) {
  const rows = db.prepare(`SELECT id, word, meaning FROM cards
    ORDER BY COALESCE((SELECT MAX(reviewed_at) FROM reviews WHERE card_id=cards.id), '') DESC, id ASC`).all() as { id: number; word: string; meaning: string }[];
  const groups = new Map<string, number[]>();
  for (const row of rows) {
    const key = JSON.stringify([row.word, row.meaning]);
    const ids = groups.get(key) ?? []; ids.push(row.id); groups.set(key, ids);
  }
  return [...groups.values()].filter(ids => ids.length > 1);
}

/**
 * Xóa các thẻ trùng, giữ lại thẻ đầu tiên của mỗi nhóm.
 * @param expected Danh sách nhóm người dùng đã xem; nếu dữ liệu đã thay đổi thì từ chối xóa.
 */
export function removeDuplicates(db: DB, expected: number[][]) {
  return db.transaction(() => {
    const groups = duplicateGroups(db);
    if (JSON.stringify(groups) !== JSON.stringify(expected)) return null;
    let deleted = 0;
    for (const [keep, ...duplicates] of groups) {
      for (const id of duplicates) {
        db.prepare('UPDATE reviews SET card_id=? WHERE card_id=?').run(keep, id);
        // Preserve each historical occurrence even when duplicate cards shared a session.
        db.prepare("INSERT INTO study_views(card_id,source,event_key,created_at) SELECT ?,source,? || event_key,created_at FROM study_views WHERE card_id=?").run(keep, `merged:${id}:`, id);
        deleted += db.prepare('DELETE FROM cards WHERE id=?').run(id).changes;
      }
    }
    return { deleted, groups: groups.length };
  })();
}
