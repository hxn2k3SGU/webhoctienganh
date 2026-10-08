import { expect, it } from "vitest";
import { estimateToeicScore } from "../src/services/toeicScoring";

it("matches reference-chart boundaries and separate Listening/Reading conversions", () => {
  for (const [correct, listening, reading] of [
    [0,5,5], [17,5,5], [18,10,5], [21,25,5], [22,30,10], [37,125,90],
    [38,135,95], [50,225,175], [58,285,240], [59,290,245], [69,350,295],
    [79,415,355], [80,420,360], [92,490,450], [93,495,455], [100,495,495],
  ]) {
    expect(estimateToeicScore({ correct, total: 100 }, { correct, total: 100 })).toEqual({
      method: "toeic-reference-v1", listening, reading, total: listening + reading,
    });
  }
  let previous = 0;
  for (let correct = 0; correct <= 100; correct++) {
    const score = estimateToeicScore({ correct, total: 100 }, { correct, total: 100 });
    expect(score.total).toBeGreaterThanOrEqual(previous);
    expect(score.listening! % 5).toBe(0); expect(score.reading! % 5).toBe(0);
    previous = score.total!;
  }
});

it("does not extrapolate partial practice into full section or total scores", () => {
  expect(estimateToeicScore({ correct: 6, total: 6 }, { correct: 0, total: 0 })).toMatchObject({ listening: null, reading: null, total: null });
  expect(estimateToeicScore({ correct: 80, total: 100 }, { correct: 20, total: 30 })).toMatchObject({ listening: 420, reading: null, total: null });
});
