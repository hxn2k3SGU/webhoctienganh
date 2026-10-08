import fs from "node:fs";
import path from "node:path";
import { z } from "zod";
import { toeicMediaUrlSchema, toeicQuestionSchema, type ToeicTest } from "@lexiloop/shared";

const librarySchema = z.array(z.object({
  id: z.string().regex(/^toeicbuilding-\d+$/),
  title: z.string().min(1).max(200),
  sourceName: z.string().min(1),
  sourceUrl: z.string().url(),
  kind: z.literal("imported"),
  listeningAudioUrl: toeicMediaUrlSchema.optional(),
  listeningDurationSeconds: z.number().int().min(1).max(3600).optional(),
  questions: z.array(toeicQuestionSchema).min(1).max(200),
}));

/** The local source library is shared; answers and attempts stay in each user's DB. */
export function toeicLibrary(directory?: string) {
  let stamp = -1;
  let tests: ToeicTest[] = [];
  return () => {
    if (!directory) return tests;
    const file = path.join(directory, "library.json");
    if (!fs.existsSync(file)) return [];
    const modified = fs.statSync(file).mtimeMs;
    if (modified !== stamp) {
      tests = librarySchema.parse(JSON.parse(fs.readFileSync(file, "utf8")));
      stamp = modified;
    }
    return tests;
  };
}
