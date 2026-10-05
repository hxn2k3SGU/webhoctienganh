import { describe, expect, it } from 'vitest';
import { buildLetterHint, countQuizLetters, listeningPoints, matchingPrefixLength, nextHintPosition, normalizeQuizAnswer } from '../src/utils/quiz';

describe('listening quiz hints', () => {
  it('reveals the letter immediately after the correctly typed prefix', () => {
    expect(matchingPrefixLength('hello', 'he')).toBe(2);
    const position = nextHintPosition('hello', 'he', []);
    expect(position).toBe(2);
    expect(buildLetterHint('hello', 'he', [position!])).toBe('hel__');
  });

  it('starts at the first letter when the input prefix is wrong', () => {
    const position = nextHintPosition('hello', 'fe', []);
    expect(position).toBe(0);
    expect(buildLetterHint('hello', 'fe', [position!])).toBe('h____');
  });

  it('keeps separators visible and opens after a phrase prefix', () => {
    const icePosition = nextHintPosition('ice cream', 'ice', []);
    expect(buildLetterHint('ice cream', 'ice', [icePosition!])).toBe('ice c____');
    const knownPosition = nextHintPosition('well-known', 'well-', []);
    expect(buildLetterHint('well-known', 'well-', [knownPosition!])).toBe('well-k____');
    expect(countQuizLetters('ice cream')).toBe(8);
  });

  it('keeps previously revealed positions when a later input is shorter', () => {
    const first = nextHintPosition('hello', 'he', []);
    const second = nextHintPosition('hello', 'h', [first!]);
    expect(buildLetterHint('hello', 'h', [first!, second!])).toBe('hel__');
    expect(new Set([first, second]).size).toBe(2);
  });

  it('normalizes case, whitespace, and typographic apostrophes', () => {
    expect(normalizeQuizAnswer('  ICE   CREAM ')).toBe('ice cream');
    expect(normalizeQuizAnswer('DON’T')).toBe("don't");
    expect(nextHintPosition("don't", 'do', [])).toBe(2);
  });

  it('scores only unique letters revealed by the system', () => {
    expect(listeningPoints('apple', 0)).toBe(100);
    expect(listeningPoints('apple', 1)).toBe(80);
    expect(listeningPoints('apple', 2)).toBe(60);
    expect(listeningPoints('go', 8)).toBe(0);
  });
});
