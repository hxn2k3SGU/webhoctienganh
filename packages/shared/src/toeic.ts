import { z } from "zod";

export const toeicParts = [
  { part: 1, title: "Photographs", count: 6, section: "Listening" },
  { part: 2, title: "Question-Response", count: 25, section: "Listening" },
  { part: 3, title: "Conversations", count: 39, section: "Listening" },
  { part: 4, title: "Talks", count: 30, section: "Listening" },
  { part: 5, title: "Incomplete Sentences", count: 30, section: "Reading" },
  { part: 6, title: "Text Completion", count: 16, section: "Reading" },
  { part: 7, title: "Reading Comprehension", count: 54, section: "Reading" },
] as const;
export const toeicChoiceSchema = z.enum(["A", "B", "C", "D"]);
const httpsUrl = z.string().url().max(2000).refine(value => /^https:\/\//i.test(value), "Use an HTTPS URL");
export const toeicMediaUrlSchema = z.union([httpsUrl, z.string().regex(/^\/api\/toeic\/media\/[a-f0-9]{64}\.(?:mp3|wav|ogg|png|jpg|jpeg|webp|gif)$/)]);
export const toeicQuestionSchema = z.object({
  id: z.string().min(1).max(100).regex(/^[A-Za-z0-9][A-Za-z0-9_-]*$/).refine(value => !["constructor", "prototype", "__proto__"].includes(value), "Reserved question ID"),
  number: z.number().int().min(1).max(200),
  part: z.number().int().min(1).max(7),
  sourceUrl: httpsUrl.optional(),
  prompt: z.string().max(4000).optional(),
  passage: z.string().max(20000).optional(),
  groupId: z.string().max(100).optional(),
  imageUrl: toeicMediaUrlSchema.optional(),
  audioUrl: toeicMediaUrlSchema.optional(),
  sourceWarning: z.string().max(1000).optional(),
  options: z.array(z.string().min(1).max(2000)).min(3).max(4).optional(),
  answer: toeicChoiceSchema,
  acceptedAnswers: z.array(toeicChoiceSchema).min(1).max(4).optional(),
  explanation: z.string().max(30000).optional(),
}).superRefine((question, ctx) => {
  if (question.part === 2 && question.answer === "D") ctx.addIssue({ code: "custom", message: "Part 2 has only A, B, C" });
  if (question.options && question.options.length !== (question.part === 2 ? 3 : 4)) ctx.addIssue({ code: "custom", message: "Invalid number of choices" });
  if (question.acceptedAnswers && (!question.acceptedAnswers.includes(question.answer) || (question.part === 2 && question.acceptedAnswers.includes("D")))) ctx.addIssue({ code: "custom", message: "Invalid accepted answers" });
});
export const toeicImportSchema = z.object({
  title: z.string().trim().min(1).max(200),
  sourceName: z.string().trim().min(1).max(200),
  sourceUrl: httpsUrl,
  usagePermission: z.string().trim().min(10).max(1000),
  listeningAudioUrl: toeicMediaUrlSchema,
  listeningDurationSeconds: z.number().int().min(1).max(3600).optional(),
  questions: z.array(toeicQuestionSchema).length(200),
}).superRefine((test, ctx) => {
  if (new Set(test.questions.map(q => q.id)).size !== 200) ctx.addIssue({ code: "custom", message: "Question IDs must be unique" });
  let number = 0;
  for (const { part, count } of toeicParts) {
    for (let i = 0; i < count; i++) {
      const q = test.questions[number++];
      if (!q || q.part !== part || q.number !== number) ctx.addIssue({ code: "custom", message: `Question ${number} must belong to Part ${part}` });
    }
  }
  for (const q of test.questions) {
    if (q.part === 1 && !q.imageUrl) ctx.addIssue({ code: "custom", message: `Question ${q.number} needs a photograph` });
    if (q.part >= 3 && (!q.prompt?.trim() || !q.options)) ctx.addIssue({ code: "custom", message: `Question ${q.number} needs a prompt and options` });
    if (q.part >= 6 && !q.passage?.trim() && !q.imageUrl) ctx.addIssue({ code: "custom", message: `Question ${q.number} needs its passage(s)` });
  }
});
export type ToeicChoice = z.infer<typeof toeicChoiceSchema>;
export type ToeicQuestion = z.infer<typeof toeicQuestionSchema>;
export type ToeicImport = z.infer<typeof toeicImportSchema>;
export type ToeicTest = {
  id: string; title: string; sourceName: string; sourceUrl: string;
  kind: "official-sample" | "imported"; usagePermission?: string; listeningAudioUrl?: string;
  listeningDurationSeconds?: number;
  questions: ToeicQuestion[];
};
export type ToeicCatalogItem = Omit<ToeicTest, "questions" | "usagePermission"> & { questionCount: number; partCounts: Record<number, number>; fullAvailable: boolean };
export type ToeicPublicQuestion = Omit<ToeicQuestion, "answer" | "acceptedAnswers" | "explanation">;
export type ToeicScaledScore = {
  method: "toeic-reference-v1";
  listening: number | null; reading: number | null; total: number | null;
};
export type ToeicResult = {
  correct: number; total: number; unanswered: number; percentage: number;
  incorrect?: number; elapsedSeconds?: number; scaledScore?: ToeicScaledScore;
  listening: { correct: number; total: number }; reading: { correct: number; total: number };
  parts: { part: number; correct: number; total: number }[];
  questions: (ToeicQuestion & { selected: ToeicChoice | null; correct: boolean })[];
};
export type ToeicAttempt = {
  id: string; testId: string; title: string; mode: "practice" | "full"; part: number | null;
  startedAt: number; deadlineAt: number | null; listeningEndsAt: number | null; submittedAt: number | null;
  serverNow: number; status: "active" | "submitted" | "expired";
  section: "practice" | "Listening" | "Reading" | "finished";
  sourceName: string; sourceUrl: string; listeningAudioUrl?: string;
  questions: ToeicPublicQuestion[]; answers: Record<string, ToeicChoice>; flags: string[];
  result: ToeicResult | null;
};
export type ToeicHistoryItem = Pick<ToeicAttempt, "id" | "title" | "mode" | "part" | "startedAt" | "submittedAt" | "status"> & { correct: number | null; total: number; scaledScore?: ToeicScaledScore | null };
