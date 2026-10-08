import express from "express";
import cors from "cors";
import helmet from "helmet";
import type { DB } from "./db";
import { loadConfig, type AppConfig } from "./config";
import { authMiddleware, authRouter } from "./auth";
import { rateLimits, originGuard } from "./middleware/security";
import { errors, notFound } from "./middleware/error";
import { workspaces } from "./workspaces";

export interface AppOptions { config?: AppConfig; disableAuth?: boolean }
/**
 * Tạo ứng dụng Express với đầy đủ middleware bảo mật, xác thực và các route API.
 * @param db Database tài khoản (bảng users, refresh_tokens).
 * @param options Cấu hình tùy chọn; dùng trong test để truyền config hoặc tắt xác thực.
 * @returns Ứng dụng Express sẵn sàng để `listen`.
 */
export function createApp(db: DB, options: AppOptions = {}) {
  const config = options.config ?? loadConfig();
  const disableAuth = options.disableAuth ?? config.NODE_ENV === "test";
  const app = express();
  app.disable("x-powered-by");
  app.use(helmet({ crossOriginResourcePolicy: { policy: "same-origin" } }));
  app.use(cors({ /** Chỉ cho phép CORS từ các origin nằm trong `DEV_ORIGINS` (hoặc request không có origin). */ origin(origin, callback) { callback(null, !origin || config.allowedOrigins.includes(origin)); }, credentials: true }));
  app.use(express.json({ limit: "1mb" }));
  app.use(rateLimits.general);
  app.use("/api/auth", originGuard(config), authRouter(db, config, rateLimits.login));
  const authenticated = authMiddleware(db, config, disableAuth);
  const spaces = workspaces(db, config);
  app.locals.closeWorkspaces = spaces.close;
  app.use("/uploads", authenticated);
  app.use("/api", originGuard(config), authenticated);
  app.use("/api/vocabulary/import", rateLimits.imports);
  /** Chuyển request đã xác thực tới workspace (database riêng) của người dùng. */
  app.use((req, res, next) => req.auth ? spaces.forUser(req.auth.userId)(req, res, next) : next());
  app.use(notFound);
  app.use(errors);
  return app;
}
