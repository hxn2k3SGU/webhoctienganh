import "dotenv/config";
import path from "node:path";
import { z } from "zod";

const bool = z.enum(["true", "false"]).transform(value => value === "true");
const schema = z.object({
  NODE_ENV: z.enum(["development", "test"]).default("development"),
  HOST: z.string().default("127.0.0.1"),
  PORT: z.coerce.number().int().min(1).max(65535).default(3001),
  DATABASE_PATH: z.string().default(path.resolve(process.cwd(), "data/lexiloop.db")),
  UPLOAD_DIR: z.string().default(path.resolve(process.cwd(), "data/uploads")),
  DEV_ORIGINS: z.string().default("http://localhost:5173,http://127.0.0.1:5173"),
  ACCESS_TOKEN_TTL_MINUTES: z.coerce.number().positive().default(15),
  REFRESH_TOKEN_TTL_DAYS: z.coerce.number().positive().default(7),
  AUTH_TOKEN_SECRET: z.preprocess(value => value === "" ? undefined : value, z.string().min(32).optional()),
  GEMINI_API_KEY: z.string().trim().optional(),
  GEMINI_MODEL: z.string().trim().min(1).default("gemini-3.8-flash"),
  AUTH_DISABLED: bool.default("false")
});
export type AppConfig = z.infer<typeof schema> & { allowedOrigins: string[] };
/**
 * Đọc và kiểm tra biến môi trường (từ `.env`) bằng Zod.
 * @param env Nguồn biến môi trường; mặc định là `process.env`.
 * @returns Cấu hình đã chuẩn hóa kèm danh sách origin được phép.
 */
export function loadConfig(env: NodeJS.ProcessEnv = process.env): AppConfig {
  const parsed = schema.parse(env);
  const allowedOrigins = parsed.DEV_ORIGINS.split(",").map(x => x.trim()).filter(Boolean);
  return { ...parsed, allowedOrigins };
}
