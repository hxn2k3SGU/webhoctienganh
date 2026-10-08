import { expect, it } from "vitest";
import { openDb, migrate } from "../src/db";
import { commitRows } from "../src/services/importExport";

it("imports into new or existing decks and leaves skipped words in their original deck", () => {
  const db = openDb(":memory:"); migrate(db);
  const row = { word: "apple", meaning: "fruit", pronunciation: "", example: "", partOfSpeech: "noun", synonyms: [], tag: "General" };
  try {
    commitRows(db, [row], "skip", "Food");
    commitRows(db, [{ ...row, word: "pear" }], "skip", "Food");
    expect(db.prepare("SELECT COUNT(*) n FROM decks").get()).toEqual({ n: 1 });
    commitRows(db, [row], "skip", "Other");
    expect(db.prepare("SELECT deck FROM cards WHERE word='apple'").get()).toEqual({ deck: "Food" });
    expect(db.prepare("SELECT COUNT(*) n FROM decks").get()).toEqual({ n: 1 });
    commitRows(db, [row], "update", "Other");
    expect(db.prepare("SELECT deck FROM cards WHERE word='apple'").get()).toEqual({ deck: "Other" });
    commitRows(db, [row], "update");
    expect(db.prepare("SELECT deck FROM cards WHERE word='apple'").get()).toEqual({ deck: "Other" });
  } finally { db.close(); }
});
