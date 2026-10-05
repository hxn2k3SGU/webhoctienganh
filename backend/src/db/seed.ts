import fs from "node:fs";import path from "node:path";import type {DB} from "./index";import {parseWorkbook,insertCards} from "../services/importExport";
/**
 * Nạp bộ từ vựng mẫu từ `seeds/words.csv`; bỏ qua từ đã tồn tại.
 * @returns Số thẻ đã nạp.
 */
export function seed(db:DB){const p=path.resolve(__dirname,"../../seeds/words.csv");return insertCards(db,parseWorkbook(fs.readFileSync(p),p));}
