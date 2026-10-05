import crypto from "node:crypto";
import type { RequestHandler } from "express";
import rateLimit from "express-rate-limit";
import type { AppConfig } from "../config";

export const rateLimits = {
  general: rateLimit({ windowMs: 60_000, limit: 300, standardHeaders: true, legacyHeaders: false }),
  login: rateLimit({ windowMs: 15 * 60_000, limit: 10, standardHeaders: true, legacyHeaders: false }),
  imports: rateLimit({ windowMs: 15 * 60_000, limit: 20, standardHeaders: true, legacyHeaders: false })
};
/** Chặn request thay đổi dữ liệu đến từ origin không nằm trong danh sách cho phép (chống CSRF). */
export function originGuard(config: AppConfig): RequestHandler {
  return (req, res, next) => {
    if (["GET", "HEAD", "OPTIONS"].includes(req.method)) return next();
    const origin = req.get("origin");
    if (!origin || !config.allowedOrigins.includes(origin)) return res.status(403).json({ error: "ORIGIN_FORBIDDEN", message: "Request origin is not allowed" });
    next();
  };
}
/** So sánh hai chuỗi trong thời gian hằng số để tránh tấn công dò theo thời gian. */
export function safeEqual(a: string, b: string): boolean {
  const x = Buffer.from(a), y = Buffer.from(b);
  return x.length === y.length && crypto.timingSafeEqual(x, y);
}
