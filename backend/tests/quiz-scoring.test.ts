import { describe, expect, it } from 'vitest';
import { quizLetterCount, quizPoints } from '../src/routes/frontend';

describe('listening quiz scoring', () => {
  it('counts only letters and numbers', () => {
    expect(quizLetterCount('ice cream')).toBe(8);
    expect(quizLetterCount("well-known! 2")).toBe(10);
  });

  it('calculates points from hidden letters and clamps hint counts', () => {
    expect(quizPoints('apple', 0)).toBe(100);
    expect(quizPoints('apple', 2)).toBe(60);
    expect(quizPoints('ice cream', 3)).toBe(63);
    expect(quizPoints('go', 99)).toBe(0);
    expect(quizPoints('go', -2)).toBe(100);
  });
});
