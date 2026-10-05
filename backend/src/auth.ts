import crypto from "node:crypto";
import argon2 from "argon2";
import { Router, type RequestHandler } from "express";
import { loginSchema } from "@lexiloop/shared";
import type { DB } from "./db";
import type { AppConfig } from "./config";
import { safeEqual } from "./middleware/security";

export const ACCESS_COOKIE = "lexiloop_access";
export const REFRESH_COOKIE = "lexiloop_refresh";
const REFRESH_PATH = "/api/auth";
export interface AuthContext { userId: number; username: string; sessionId: number; csrfToken: string; expiresAt?: number }
interface AccessPayload { sub: number; username: string; sid: number; csrf: string; exp: number }
type Req = Parameters<RequestHandler>[0];
type Res = Parameters<RequestHandler>[1];
/** Băm token bằng SHA-256 để lưu vào database thay vì lưu token gốc. */
const hashToken = (token: string) => crypto.createHash("sha256").update(token).digest("hex");
/** Sinh một chuỗi ngẫu nhiên 32 byte (base64url) dùng làm refresh token hoặc CSRF token. */
const randomToken = () => crypto.randomBytes(32).toString("base64url");
const fallbackSecret = randomToken();
/** Lấy khóa ký access token; nếu chưa cấu hình `AUTH_TOKEN_SECRET` thì dùng khóa tạm sinh khi khởi động. */
const secret = (config: AppConfig) => config.AUTH_TOKEN_SECRET || fallbackSecret;
/** Thời gian sống của access token tính bằng mili giây (mặc định 15 phút). */
const accessTtl = (config: AppConfig) => config.ACCESS_TOKEN_TTL_MINUTES * 60_000;
/** Thời gian sống của refresh token tính bằng mili giây (mặc định 7 ngày). */
const refreshTtl = (config: AppConfig) => config.REFRESH_TOKEN_TTL_DAYS * 86_400_000;
/**
 * Đọc giá trị một cookie từ header `Cookie` của request.
 * @param name Tên cookie cần đọc.
 * @returns Giá trị đã giải mã, hoặc `undefined` nếu không có.
 */
function cookie(req: { headers: { cookie?: string } }, name: string): string | undefined {
  const found = req.headers.cookie?.split(";").map(x => x.trim()).find(x => x.startsWith(`${name}=`));
  return found ? decodeURIComponent(found.slice(name.length + 1)) : undefined;
}
/**
 * Tạo tùy chọn cookie an toàn (httpOnly, sameSite strict).
 * @param path Đường dẫn cookie có hiệu lực.
 * @param maxAge Thời gian sống (ms); bỏ trống khi xóa cookie.
 */
function options(path: string, maxAge?: number) { return { httpOnly: true, sameSite: "strict" as const, path, ...(maxAge ? { maxAge } : {}) }; }
/** Ký dữ liệu bằng HMAC-SHA256 với khóa bí mật của server. */
const sign = (data: string, config: AppConfig) => crypto.createHmac("sha256", secret(config)).update(data).digest("base64url");
/**
 * Tạo access token có chữ ký chứa thông tin người dùng, phiên và CSRF token.
 * @param expiresAt Thời điểm hết hạn (epoch ms).
 * @returns Chuỗi dạng `payload.signature`.
 */
export function createAccessToken(config: AppConfig, auth: AuthContext, expiresAt: number) {
  const payload: AccessPayload = { sub: auth.userId, username: auth.username, sid: auth.sessionId, csrf: auth.csrfToken, exp: expiresAt };
  const body = Buffer.from(JSON.stringify(payload)).toString("base64url");
  return `${body}.${sign(body, config)}`;
}
/**
 * Kiểm tra chữ ký và hạn dùng của access token.
 * @returns Thông tin xác thực nếu token hợp lệ, ngược lại `undefined`.
 */
export function readAccessToken(config: AppConfig, token?: string): AuthContext | undefined {
  if (!token) return undefined;
  const [body, signature] = token.split(".");
  if (!body || !signature || !safeEqual(signature, sign(body, config))) return undefined;
  try {
    const payload = JSON.parse(Buffer.from(body, "base64url").toString("utf8")) as AccessPayload;
    if (typeof payload.exp !== "number" || payload.exp <= Date.now()) return undefined;
    return { userId: payload.sub, username: payload.username, sessionId: payload.sid, csrfToken: payload.csrf, expiresAt: payload.exp };
  } catch { return undefined; }
}
/**
 * Tìm refresh token còn hạn trong bảng `refresh_tokens`.
 * @returns Thông tin xác thực nếu token tồn tại và chưa hết hạn.
 */
export function readRefreshToken(db: DB, token?: string): AuthContext | undefined {
  if (!token) return undefined;
  return db.prepare(`SELECT r.id sessionId,r.csrf_token csrfToken,u.id userId,u.username
    FROM refresh_tokens r JOIN users u ON u.id=r.user_id WHERE r.token_hash=? AND r.expires_at>?`).get(hashToken(token), new Date().toISOString()) as AuthContext | undefined;
}
/** Xóa cả cookie access token và refresh token khỏi trình duyệt. */
function clearAuthCookies(res: Res, config: AppConfig) {
  return res.clearCookie(ACCESS_COOKIE, options("/")).clearCookie(REFRESH_COOKIE, options(REFRESH_PATH));
}
/**
 * Cấp cặp token mới: lưu refresh token (đã băm) vào database và đặt hai cookie.
 * Đồng thời dọn các refresh token đã hết hạn.
 * @param csrfToken Giữ CSRF token cũ khi xoay vòng token; mặc định sinh mới.
 * @returns Dữ liệu phiên trả về cho client.
 */
function issueTokens(db: DB, config: AppConfig, req: Req, res: Res, user: { id: number; username: string }, csrfToken = randomToken()) {
  const now = Date.now();
  db.prepare("DELETE FROM refresh_tokens WHERE expires_at<=?").run(new Date(now).toISOString());
  const refreshToken = randomToken();
  const refreshExpiresAt = new Date(now + refreshTtl(config)).toISOString();
  const result = db.prepare("INSERT INTO refresh_tokens(user_id,token_hash,csrf_token,expires_at,user_agent,ip_address) VALUES (?,?,?,?,?,?)")
    .run(user.id, hashToken(refreshToken), csrfToken, refreshExpiresAt, req.get("user-agent") || null, req.ip);
  const auth: AuthContext = { userId: user.id, username: user.username, sessionId: Number(result.lastInsertRowid), csrfToken };
  const accessExpiresAt = now + accessTtl(config);
  res.cookie(ACCESS_COOKIE, createAccessToken(config, auth, accessExpiresAt), options("/", accessTtl(config)))
    .cookie(REFRESH_COOKIE, refreshToken, options(REFRESH_PATH, refreshTtl(config)));
  return { user, csrfToken, accessTokenExpiresAt: new Date(accessExpiresAt).toISOString(), refreshTokenExpiresAt: refreshExpiresAt };
}
/**
 * Xoay vòng refresh token: xóa token hiện tại và cấp cặp token mới.
 * @returns Dữ liệu phiên mới, hoặc `undefined` nếu refresh token không hợp lệ.
 */
function rotateRefreshToken(db: DB, config: AppConfig, req: Req, res: Res) {
  const current = readRefreshToken(db, cookie(req, REFRESH_COOKIE));
  if (!current) return undefined;
  db.prepare("DELETE FROM refresh_tokens WHERE id=?").run(current.sessionId);
  return issueTokens(db, config, req, res, { id: current.userId, username: current.username }, current.csrfToken);
}
/**
 * Middleware bắt buộc đăng nhập bằng access token.
 * Với request thay đổi dữ liệu (POST/PUT/PATCH/DELETE) còn kiểm tra header `X-CSRF-Token`.
 * @param disabled Bỏ qua xác thực (chỉ dùng trong test).
 */
export function authMiddleware(db: DB, config: AppConfig, disabled = false): RequestHandler {
  return (req, res, next) => {
    if (disabled) { req.auth = { userId: 0, username: "test", sessionId: 0, csrfToken: "test-csrf" }; return next(); }
    const auth = readAccessToken(config, cookie(req, ACCESS_COOKIE));
    if (!auth) return res.status(401).json({ error: "UNAUTHENTICATED", message: "Authentication required" });
    req.auth = auth;
    if (!["GET", "HEAD", "OPTIONS"].includes(req.method) && !safeEqual(req.get("x-csrf-token") || "", auth.csrfToken)) return res.status(403).json({ error: "CSRF_INVALID", message: "Valid X-CSRF-Token required" });
    next();
  };
}
/**
 * Router `/api/auth`: đăng ký, đăng nhập, làm mới token, xem phiên và đăng xuất.
 * @param loginLimit Middleware giới hạn số lần đăng nhập/đăng ký.
 */
export function authRouter(db: DB, config: AppConfig, loginLimit: RequestHandler) {
  const router = Router();
  /** Cấp token cho người dùng vừa đăng nhập/đăng ký và trả JSON phiên. */
  const sendSession = (req: Req, res: Res, user: { id: number; username: string }) => res.json(issueTokens(db, config, req, res, user));
  /** Cho biết hệ thống đã có tài khoản nào chưa (để hiển thị màn hình thiết lập ban đầu). */
  router.get("/setup-status", (_req, res) => {
    const count = (db.prepare("SELECT COUNT(*) count FROM users").get() as { count: number }).count;
    res.json({ setupRequired: count === 0 });
  });
  /** Đăng ký tài khoản mới; tài khoản đầu tiên dùng workspace `legacy`, các tài khoản sau có workspace riêng. */
  router.post("/register", loginLimit, (req, res, next) => { void (async () => {
    const parsed = loginSchema.safeParse(req.body); if (!parsed.success) return res.status(400).json({ error: "VALIDATION_FAILED", details: parsed.error.flatten() }); const input = parsed.data;
    const passwordHash = await argon2.hash(input.password, { type: argon2.argon2id, memoryCost: 65536, timeCost: 3, parallelism: 1 });
    const user = db.transaction(() => {
      const first = !db.prepare("SELECT 1 FROM users LIMIT 1").get();
      const result = db.prepare("INSERT INTO users(username,password_hash,workspace) VALUES (?,?,?)").run(input.username, passwordHash, first ? "legacy" : "private");
      return { id: Number(result.lastInsertRowid), username: input.username };
    })();
    return sendSession(req, res, user);
  })().catch(next); });
  /** Tạo tài khoản đầu tiên; trả 409 nếu hệ thống đã có người dùng. */
  router.post("/setup", loginLimit, (req, res, next) => { void (async () => {
    const parsed = loginSchema.safeParse(req.body); if (!parsed.success) return res.status(400).json({ error: "VALIDATION_FAILED", details: parsed.error.flatten() }); const input = parsed.data;
    const passwordHash = await argon2.hash(input.password, { type: argon2.argon2id, memoryCost: 65536, timeCost: 3, parallelism: 1 });
    const result = db.prepare(`INSERT INTO users(username,password_hash,workspace)
      SELECT ?,?,'legacy' WHERE NOT EXISTS (SELECT 1 FROM users)`).run(input.username, passwordHash);
    if (result.changes !== 1) return res.status(409).json({ error: "SETUP_COMPLETE", message: "Initial setup has already been completed" });
    return sendSession(req, res, { id: Number(result.lastInsertRowid), username: input.username });
  })().catch(next); });
  /** Đăng nhập bằng tên đăng nhập và mật khẩu (băm Argon2id). */
  router.post("/login", loginLimit, (req, res, next) => { void (async () => {
    const parsed = loginSchema.safeParse(req.body); if (!parsed.success) return res.status(400).json({ error: "VALIDATION_FAILED", details: parsed.error.flatten() }); const input = parsed.data;
    const user = db.prepare("SELECT id,username,password_hash passwordHash FROM users WHERE username=?").get(input.username) as any;
    const valid = user && await argon2.verify(user.passwordHash, input.password);
    if (!valid) return res.status(401).json({ error: "INVALID_CREDENTIALS", message: "Invalid username or password" });
    return sendSession(req, res, { id: user.id, username: user.username });
  })().catch(next); });
  /** Trả phiên hiện tại; nếu access token hết hạn thì tự dùng refresh token để cấp lại. */
  router.get("/session", (req, res) => {
    const auth = readAccessToken(config, cookie(req, ACCESS_COOKIE));
    if (auth) return res.json({ user: { id: auth.userId, username: auth.username }, csrfToken: auth.csrfToken, accessTokenExpiresAt: new Date(auth.expiresAt!).toISOString() });
    const refreshed = rotateRefreshToken(db, config, req, res);
    if (!refreshed) return clearAuthCookies(res, config).status(401).json({ error: "UNAUTHENTICATED" });
    res.json(refreshed);
  });
  /** Đổi refresh token lấy access token mới (đồng thời xoay vòng refresh token). */
  router.post("/refresh", (req, res) => {
    const refreshed = rotateRefreshToken(db, config, req, res);
    if (!refreshed) return clearAuthCookies(res, config).status(401).json({ error: "UNAUTHENTICATED", message: "Refresh token is invalid or expired" });
    res.json(refreshed);
  });
  /** Trả CSRF token của phiên đang đăng nhập. */
  router.get("/csrf", authMiddleware(db, config), (req, res) => res.json({ csrfToken: req.auth!.csrfToken }));
  /** Đăng xuất thiết bị hiện tại: xóa refresh token trong database và xóa cookie. */
  router.post("/logout", (req, res) => {
    const refreshToken = cookie(req, REFRESH_COOKIE);
    if (refreshToken) db.prepare("DELETE FROM refresh_tokens WHERE token_hash=?").run(hashToken(refreshToken));
    clearAuthCookies(res, config).status(204).end();
  });
  /** Đăng xuất mọi thiết bị: xóa toàn bộ refresh token của người dùng. */
  router.post("/logout-all", authMiddleware(db, config), (req, res) => { db.prepare("DELETE FROM refresh_tokens WHERE user_id=?").run(req.auth!.userId); clearAuthCookies(res, config).status(204).end(); });
  return router;
}
/**
 * Đặt lại toàn bộ tài khoản, chỉ giữ một tài khoản quản trị duy nhất.
 * Xóa hết người dùng và refresh token hiện có.
 */
export async function setAdmin(db: DB, username: string, password: string) {
  const input = loginSchema.parse({ username, password });
  const passwordHash = await argon2.hash(input.password, { type: argon2.argon2id, memoryCost: 65536, timeCost: 3, parallelism: 1 });
  db.transaction(() => { db.prepare("DELETE FROM refresh_tokens").run(); db.prepare("DELETE FROM users").run(); db.prepare("INSERT INTO users(username,password_hash) VALUES (?,?)").run(input.username, passwordHash); })();
}
