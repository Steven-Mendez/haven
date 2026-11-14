import { describe, expect, it } from 'vitest';

import { bucketSeries, flaggedPoints, niceTicks } from './chart-math';

describe('niceTicks', () => {
  it('gives round integers, at most 3', () => {
    expect(niceTicks(45, 105)).toEqual([60, 80, 100]);
    expect(niceTicks(59.2, 72.4)).toEqual([60, 65, 70]);
    expect(niceTicks(0, 1, 3).every((v) => Number.isFinite(v))).toBe(true);
    expect(niceTicks(10, 10)).toEqual([10]);
  });
});

describe('bucketSeries', () => {
  it('summarises each window with its median and range', () => {
    const h = 3_600_000;
    const out = bucketSeries(
      [
        [0, 60],
        [h, 70],
        [2 * h, 64],
        [7 * h, 80],
      ],
      6 * h,
    );
    expect(out).toHaveLength(2);
    expect(out[0]).toMatchObject({ median: 64, min: 60, max: 70, n: 3 });
    expect(out[1]).toMatchObject({ median: 80, n: 1 });
  });
});

describe('aggregation keeps out-of-range points', () => {
  it('the daily median hides a 190 spike, flaggedPoints keeps it at its real value', () => {
    const h = 3_600_000;
    const raw: [number, number][] = [
      [0, 118],
      [h, 120],
      [2 * h, 190],
      [3 * h, 119],
    ];
    const day = bucketSeries(raw, 24 * h);
    expect(day).toHaveLength(1);
    expect(day[0].median).toBeLessThan(140);
    const flagged = flaggedPoints(raw, { referenceRange: [90, 139] });
    expect(flagged).toEqual([{ t: 2 * h, v: 190, level: 'amber' }]);
  });

  it('ignores the personal range when a reference range exists', () => {
    const raw: [number, number][] = [
      [1, 58],
      [2, 75],
      [3, 110],
    ];
    expect(flaggedPoints(raw, { referenceRange: [50, 100], personalRange: [62, 71] })).toEqual([
      { t: 3, v: 110, level: 'amber' },
    ]);
  });

  it('never flags a reading the engine rates green or pending', () => {
    const flagged = flaggedPoints([[1, 150]], {
      levelAt: () => 'green',
      referenceRange: [90, 139],
    });
    expect(flagged).toEqual([]);
  });

  it('uses the engine level (red wins) and the personal range only without a reference', () => {
    const raw: [number, number][] = [
      [1, 70],
      [2, 80],
      [3, 200],
    ];
    const flagged = flaggedPoints(raw, {
      levelAt: (_, v) => (v > 150 ? 'red' : undefined),
      personalRange: [60, 75],
    });
    expect(flagged).toEqual([
      { t: 2, v: 80, level: 'amber' },
      { t: 3, v: 200, level: 'red' },
    ]);
  });
});
