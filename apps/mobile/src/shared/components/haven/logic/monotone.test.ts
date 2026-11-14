import { describe, expect, it } from 'vitest';

import { monotonePath } from './monotone';

const numbers = (d: string) => (d.match(/-?\d+(\.\d+)?/g) ?? []).map(Number);

describe('monotonePath', () => {
  it('handles empty and single points', () => {
    expect(monotonePath([])).toBe('');
    expect(monotonePath([[1, 2]])).toBe('M 1 2');
  });

  it('never overshoots a monotone series', () => {
    const pts: [number, number][] = [
      [0, 0],
      [10, 1],
      [20, 30],
      [30, 31],
      [40, 31],
    ];
    const ys = numbers(monotonePath(pts)).filter((_, i) => i % 2 === 1);
    for (const y of ys) {
      expect(y).toBeGreaterThanOrEqual(0);
      expect(y).toBeLessThanOrEqual(31);
    }
  });

  it('keeps flat stretches flat', () => {
    const d = monotonePath([
      [0, 5],
      [10, 5],
      [20, 5],
    ]);
    const ys = numbers(d).filter((_, i) => i % 2 === 1);
    expect(new Set(ys)).toEqual(new Set([5]));
  });
});
