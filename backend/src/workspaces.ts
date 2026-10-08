import express, { Router } from "express";
import path from "node:path";
import { migrate, openDb, type DB } from "./db";
import type { AppConfig } from "./config";
import { cardsRouter } from "./routes/cards";
import { vocabularyRouter } from "./routes/vocabulary";
import { frontendRouter } from "./routes/frontend";
import { studyRouter } from "./routes/study";
import { systemRouter } from "./routes/system";
import { filesRouter } from "./routes/files";
import { decksRouter } from "./routes/decks";
import { progressRouter } from "./routes/progress";
import { studySummaryRouter } from "./routes/studySummary";
import { toeicRouter } from "./routes/toeic";

/**
 * Quản lý database riêng cho từng tài khoản (mỗi người dùng một file SQLite).
 * @returns `forUser` để lấy router của người dùng và `close` để đóng mọi database.
 */
export function workspaces(accounts: DB, config: AppConfig) {
  const entries = new Map<number, { db: DB; router: Router }>();
  /** Lấy (hoặc tạo và lưu cache) router API gắn với database của người dùng; tài khoản `legacy` dùng database chính. */
  function forUser(userId: number) {
    const legacy = userId === 0 || (accounts.prepare("SELECT workspace FROM users WHERE id=?").get(userId) as { workspace: string } | undefined)?.workspace === "legacy";
    const key = legacy ? 0 : userId;
    const cached = entries.get(key);
    if (cached) return cached.router;
    const db = legacy ? accounts : openDb(accounts.name === ":memory:" ? ":memory:" : path.join(path.dirname(accounts.name), "accounts", `${userId}.db`));
    if (!legacy) migrate(db);
    const uploads = legacy ? config.UPLOAD_DIR : path.join(config.UPLOAD_DIR, "accounts", String(userId));
    const router = Router();
    router.use("/api/toeic", toeicRouter(db, accounts.name === ":memory:" ? undefined : path.join(path.dirname(accounts.name), "toeicbuilding")));
    router.use("/api/decks", decksRouter(db));
    router.use("/api/progress", progressRouter(db));
    router.use("/api/study/summary", studySummaryRouter(db));
    /** Phục vụ file âm thanh cục bộ của người dùng, chặn đường dẫn có ký tự thư mục. */
    router.use("/uploads", (req, res, next) => {
      const name = decodeURIComponent(req.path.slice(1));
      if (!name || name.includes("/") || name.includes("\\")) return res.sendStatus(404);
      next();
    }, express.static(uploads, { dotfiles: "deny", fallthrough: false }));
    router.use("/api/vocabulary", vocabularyRouter(db));
    router.use("/api", frontendRouter(db, config));
    router.use("/api/cards", cardsRouter(db));
    router.use("/api/study", studyRouter(db));
    router.use("/api", systemRouter(db));
    router.use("/api", filesRouter(db));
    entries.set(key, { db, router });
    return router;
  }
  return { forUser, close: () => { for (const entry of entries.values()) if (entry.db !== accounts) entry.db.close(); entries.clear(); } };
}
