import { z } from "zod";

export const loginSchema = z.object({
  username: z.string().trim().min(3).max(64).regex(/^[A-Za-z0-9._-]+$/),
  password: z.string().min(12).max(256)
});
export type LoginInput = z.infer<typeof loginSchema>;

export const topics = ["daily-life", "travel", "work-study"] as const;
export const ratings = ["again", "hard", "good", "easy"] as const;
export const cardStatus = ["new", "learning", "review"] as const;
export const topicSchema = z.enum(topics);
export const ratingSchema = z.enum(ratings);

const optionalText = z.string().trim().max(2000).optional().nullable();
export const createCardSchema = z.object({
  word: z.string().trim().min(1).max(120),
  meaning: z.string().trim().min(1).max(500),
  example: optionalText,
  pronunciation: z.string().trim().max(120).optional().nullable(),
  partOfSpeech: z.string().trim().max(80).optional().nullable(),
  topic: topicSchema,
  imageUrl: optionalText,
  audioUrl: optionalText,
  tags: z.array(z.string().trim().min(1).max(40)).max(20).default([])
});
export const updateCardSchema = createCardSchema.partial().refine(v => Object.keys(v).length > 0, "At least one field is required");
export const cardQuerySchema = z.object({
  search: z.string().trim().optional(), topic: topicSchema.optional(), status: z.enum(cardStatus).optional(),
  page: z.coerce.number().int().positive().default(1), limit: z.coerce.number().int().min(1).max(100).default(20)
});
export const reviewSchema = z.object({
  cardId: z.coerce.number().int().positive(), rating: ratingSchema,
  idempotencyKey: z.string().trim().min(8).max(128), reviewedAt: z.string().datetime().optional()
});
export const queueQuerySchema = z.object({ limit: z.coerce.number().int().min(1).max(100).default(20) });
export const quizAnswerSchema = z.object({ cardId: z.coerce.number().int().positive(), answer: z.string().trim().min(1) });
export const frontendStatusSchema = z.enum(["New", "Learning", "Review", "Mastered"]);
export const vocabularyInputSchema = z.object({
  word: z.string().trim().min(1).max(120), meaning: z.string().trim().min(1).max(500),
  pronunciation: z.string().trim().max(120).optional().default(""), example: z.string().trim().max(2000).optional().default(""),
  partOfSpeech: z.string().trim().max(80).optional().default(""), synonyms: z.array(z.string().trim().min(1).max(120)).max(30).default([]),
  imageUrl: z.string().trim().max(2000).optional().default(""), audioUrl: z.string().trim().max(2000).optional().default(""),
  tag: z.string().trim().min(1).max(120), status: frontendStatusSchema.optional(), deck: z.string().trim().max(100).optional()
});
export const settingsSchema = z.object({ quizQuestionCount: z.number().int().min(1).max(50).default(10), dailyNewLimit: z.number().int().min(1).max(100), dailyReviewLimit: z.number().int().min(5).max(500), soundEffects: z.boolean().default(true), speechVolume: z.number().int().min(0).max(100).default(100), soundEffectsVolume: z.number().int().min(0).max(100).default(100), autoPlayAudio: z.boolean(), showExamplesFirst: z.boolean(), theme: z.enum(["light","dark","system"]) });

export const importDuplicateStrategySchema = z.enum(["skip", "update"]);
export const importRowSchema = z.object({
  word: z.string().trim().min(1).max(120),
  meaning: z.string().trim().min(1).max(500),
  pronunciation: z.string().trim().max(120).default(""),
  example: z.string().trim().max(2000).default(""),
  partOfSpeech: z.string().trim().max(80).default(""),
  synonyms: z.array(z.string().trim().min(1).max(120)).max(30).default([]),
  imageUrl: z.string().trim().max(2000).default(""),
  tag: z.string().trim().min(1).max(120).default("General")
});
export const importCommitSchema = z.object({
  deck: z.string().trim().max(100).optional(),
  token: z.string().uuid(),
  duplicateStrategy: importDuplicateStrategySchema.default("skip"),
  rows: z.array(importRowSchema).min(1).max(10000)
});
export type ImportRow = z.infer<typeof importRowSchema>;
export type ImportDuplicateStrategy = z.infer<typeof importDuplicateStrategySchema>;
export type Topic = z.infer<typeof topicSchema>;
export type Rating = z.infer<typeof ratingSchema>;
export type CreateCardInput = z.infer<typeof createCardSchema>;
export type ReviewInput = z.infer<typeof reviewSchema>;
export interface Card extends CreateCardInput { id:number; status:typeof cardStatus[number]; easeFactor:number; intervalDays:number; repetitions:number; dueAt:string; createdAt:string; updatedAt:string; }
