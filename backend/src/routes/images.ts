import { Router } from "express";
import { z } from "zod";
import rateLimit from "express-rate-limit";
import type { AppConfig } from "../config";
import { ImageSearchError, searchImages } from "../services/imageSearch";

/** Router `/api/images`: tìm ảnh minh họa bằng AI. */
export function imagesRouter(config: AppConfig) {
  const router = Router();
  /** Tìm ảnh minh họa cho một từ (Gemini gợi ý từ khóa, Wikimedia Commons cung cấp ảnh); giới hạn 10 lượt/phút. */
  router.post("/search", rateLimit({ windowMs: 60000, limit: 10, keyGenerator: req => String(req.auth!.userId), standardHeaders: true, legacyHeaders: false, message: { message: "Bạn đã tìm ảnh nhiều lần. Vui lòng đợi một phút." } }), async (req, res, next) => {
    const parsed = z.object({ word: z.string().trim().min(1).max(200), meaning: z.string().trim().min(1).max(1000) }).safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ message: "Vui lòng nhập từ và nghĩa hợp lệ trước khi tìm ảnh." });
    try { res.json(await searchImages(parsed.data.word, parsed.data.meaning, config)); }
    catch (error) { if (error instanceof ImageSearchError) return res.status(error.status).json({ message: error.message }); next(error); }
  });
  return router;
}
