import { expect, it } from 'vitest';
import { openDb, migrate } from '../src/db';
import { duplicateGroups, removeDuplicates } from '../src/services/duplicates';

it('removes only exact pairs and preserves review and view history', () => {
  const db = openDb(':memory:'); migrate(db);
  try {
    const add = db.prepare("INSERT INTO cards(word,meaning,topic) VALUES (?,?,'daily-life')");
    for (const pair of [['apple','fruit'], ['apple','fruit'], ['Apple','fruit'], ['apple','Fruit'], ['apple ','fruit'], ['apple','other']]) add.run(...pair);
    db.exec("INSERT INTO reviews(card_id,rating,idempotency_key,previous_interval,next_interval,reviewed_at) VALUES (2,'good','review',0,1,'2026-01-01')");
    db.exec("INSERT INTO study_views(card_id,source,event_key) VALUES (1,'quiz','same'),(2,'quiz','same')");
    const groups = duplicateGroups(db);
    expect(groups).toEqual([[2,1]]);
    expect(removeDuplicates(db, [])).toBeNull();
    expect(removeDuplicates(db, groups)).toEqual({ deleted: 1, groups: 1 });
    expect(db.prepare('SELECT id FROM cards ORDER BY id').all()).toHaveLength(5);
    expect(db.prepare('SELECT card_id FROM reviews').get()).toEqual({ card_id: 2 });
    expect(db.prepare('SELECT card_id FROM study_views').all()).toEqual([{card_id:2}, {card_id:2}]);
    expect(duplicateGroups(db)).toEqual([]);
    expect(removeDuplicates(db, groups)).toBeNull();
  } finally { db.close(); }
});
