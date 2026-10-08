import type { ToeicQuestion, ToeicTest } from "@lexiloop/shared";

// Answer keys checked against the official IIBC sample pages on 2026-10-07.
// Question text, photographs and recordings remain on the publisher's website.
const samples: { part: number; page: string; numbers: number[]; answers: string }[] = [
  { part: 1, page: "01", numbers: [1, 2], answers: "AD" },
  { part: 2, page: "02", numbers: [7, 8, 9, 10], answers: "ABAC" },
  { part: 3, page: "03", numbers: [32,33,34,35,36,37,38,39,40,41,42,43], answers: "BDAACDADCABC" },
  { part: 4, page: "04", numbers: [71,72,73,74,75,76,77,78,79,80,81,82], answers: "BBDABCDDBDBC" },
  { part: 5, page: "05", numbers: [101,102,103,104,105], answers: "DCDDB" },
  { part: 6, page: "06", numbers: [131,132,133,134], answers: "CADB" },
  { part: 7, page: "07_01", numbers: [147,148,149,150,151], answers: "ADBAC" },
  { part: 7, page: "07_02", numbers: [152,153,161,162,163,164], answers: "CCADBA" },
  { part: 7, page: "07_03", numbers: [176,177,178,179,180], answers: "ABDBD" },
  { part: 7, page: "07_04", numbers: [196,197,198,199,200], answers: "BDACA" },
];
export const officialToeicSample: ToeicTest = {
  id: "iibc-official-samples",
  title: "TOEIC Listening & Reading - Official Samples",
  kind: "official-sample",
  sourceName: "IIBC / ETS",
  sourceUrl: "https://www.iibc-global.org/english/toeic/test/lr/about/format.html",
  questions: samples.flatMap(sample => sample.numbers.map((number, index): ToeicQuestion => ({
    id: `iibc-${number}`, number, part: sample.part,
    sourceUrl: `https://www.iibc-global.org/toeic/test/lr/about/format/sample${sample.page}.html`,
    answer: sample.answers[index] as ToeicQuestion["answer"],
  }))),
};
