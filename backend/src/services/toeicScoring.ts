import type { ToeicResult, ToeicScaledScore } from "@lexiloop/shared";

// Reference chart, inspected 2026-10-08: https://prepedu.com/vi/blog/thang-diem-toeic
// Rows 18..100: [Listening, Reading]. Counts 0..17 receive the section minimum.
// This is a practice estimate, not ETS equating or TOEIC Building's private table.
const reference: readonly (readonly [number, number])[] = [
  [10,5], [15,5], [20,5], [25,5], [30,10], [35,15], [40,20], [45,25], [50,30], [55,35],
  [60,40], [70,45], [80,55], [85,60], [90,65], [95,70], [100,75], [105,80], [115,85], [125,90],
  [135,95], [140,105], [150,115], [160,120], [170,125], [175,130], [180,135], [190,140], [200,145], [205,155],
  [215,160], [220,170], [225,175], [230,185], [235,195], [245,205], [255,210], [260,215], [265,220], [275,230], [285,240],
  [290,245], [295,250], [300,255], [310,260], [320,270], [325,275], [330,280], [335,285], [340,290], [345,295],
  [350,295], [355,300], [360,310], [365,315], [370,320], [375,325], [385,330], [395,335], [400,340], [405,345], [415,355],
  [420,360], [425,370], [430,375], [435,385], [440,390], [445,395], [455,405], [460,415], [465,420], [475,425],
  [480,435], [485,440], [490,450], [495,455], [495,460], [495,470], [495,475], [495,485], [495,485], [495,490], [495,495],
];

export function estimateToeicScore(listening: ToeicResult["listening"], reading: ToeicResult["reading"]): ToeicScaledScore {
  const convert = ({ correct, total }: ToeicResult["listening"], column: 0 | 1) => {
    if (total !== 100 || !Number.isInteger(correct) || correct < 0 || correct > 100) return null;
    return correct <= 17 ? 5 : reference[correct - 18][column];
  };
  const l = convert(listening, 0), r = convert(reading, 1);
  return { method: "toeic-reference-v1", listening: l, reading: r, total: l !== null && r !== null ? l + r : null };
}

/** Enrich older stored results without changing their answers or submission time. */
export function withToeicScore(result: ToeicResult, startedAt: number, submittedAt: number): ToeicResult {
  return { ...result,
    incorrect: result.total - result.correct - result.unanswered,
    elapsedSeconds: Math.max(0, Math.floor((submittedAt - startedAt) / 1000)),
    scaledScore: result.scaledScore ?? estimateToeicScore(result.listening, result.reading),
  };
}
