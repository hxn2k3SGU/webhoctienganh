import { describe, expect, it } from 'vitest';
import { scoreMood } from '../src/utils/scoreMood';

describe('score milestones', () => {
  it.each([[0, 'encourage'], [49, 'encourage'], [50, 'steady'], [69, 'steady'], [70, 'good'], [84, 'good'], [85, 'great'], [99, 'great'], [100, 'perfect']])('maps %s percent to %s', (points, tone) => {
    expect(scoreMood(Number(points), 100).tone).toBe(tone);
  });
  it('stays neutral before any answers and uses the available points', () => {
    expect(scoreMood(0, 0).tone).toBe('neutral');
    expect(scoreMood(170, 200).tone).toBe('great');
    expect(scoreMood(170, 1000).tone).toBe('encourage');
  });
});
