import { expect, it } from "vitest";
import { openDb, migrate } from "../src/db";
import { learningProgress } from "../src/routes/progress";

it("keeps yesterday's streak, counts quiz days once and preserves earned badges", () => {
  const db = openDb(":memory:"); migrate(db);
  try {
    expect(learningProgress(db).streak).toBe(0);
    for (const days of [-3, -2, -1]) db.prepare("INSERT INTO quiz_activity(session_id,studied_at) VALUES (?,datetime('now',?))").run(String(days), `${days} day`);
    let result = learningProgress(db);
    expect(result.streak).toBe(3);
    expect(result.studiedToday).toBe(false);
    expect(result.achievements.find(item => item.id === 'streak-3')?.unlockedAt).toBeTruthy();
    db.prepare("INSERT INTO quiz_activity(session_id) VALUES ('today'),('today-again')").run();
    result = learningProgress(db);
    expect(result.streak).toBe(4);
    expect(result.studiedToday).toBe(true);
    db.prepare("UPDATE quiz_activity SET studied_at=datetime(studied_at,'-10 day')").run();
    result = learningProgress(db);
    expect(result.streak).toBe(0);
    expect(result.longest).toBe(4);
    expect(result.achievements.find(item => item.id === 'streak-3')?.unlockedAt).toBeTruthy();
  } finally { db.close(); }
});
it("counts distinct remembered words rather than repeated reviews", () => {
  const db = openDb(":memory:"); migrate(db);
  try {
    db.exec("INSERT INTO cards(word,meaning,topic) VALUES ('apple','fruit','daily-life')");
    const insert = db.prepare("INSERT INTO reviews(card_id,rating,idempotency_key,previous_interval,next_interval,reviewed_at) VALUES (1,?,?,0,1,CURRENT_TIMESTAMP)");
    insert.run('again', 'a');
    expect(learningProgress(db).learned).toBe(0);
    insert.run('good', 'b'); insert.run('easy', 'c');
    expect(learningProgress(db).learned).toBe(1);
    db.exec("DELETE FROM cards");
    expect(learningProgress(db).achievements.find(item => item.id === 'words-1')?.unlockedAt).toBeTruthy();
  } finally { db.close(); }
});
