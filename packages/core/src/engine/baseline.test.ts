import { describe, expect, it } from 'vitest';
import { baselineWidth, computeBaseline, computeBaselines, deviation } from './baseline';
import { reading } from './test-fixtures';

describe('computeBaseline', () => {
  it('median and p10–p90 of the last N readings', () => {
    const rs = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11].map((v, i) => reading('hrv', v, (100 - i) * 60));
    expect(computeBaseline(rs, 'hrv')).toEqual({ median: 6, range: [2, 10] });
    expect(computeBaseline(rs, 'hrv', { n: 5 })).toEqual({ median: 9, range: [7.4, 10.6] });
  });

  it('undefined with fewer than 5 numeric readings', () => {
    const rs = [1, 2, 3, 4].map((v, i) => reading('hrv', v, i * 60));
    expect(computeBaseline(rs, 'hrv')).toBeUndefined();
    expect(computeBaseline([...rs, reading('hrv', 'x')], 'hrv')).toBeUndefined();
  });

  it('`before` excludes the reading being evaluated', () => {
    const rs = [50, 52, 48, 51, 49, 90].map((v, i) => reading('hrv', v, (10 - i) * 60));
    const last = rs.at(-1);
    if (!last) throw new Error();
    expect(computeBaseline(rs, 'hrv', { before: new Date(last.takenAt) })?.median).toBe(50);
  });

  it('width has a 5 % floor and deviation is signed', () => {
    expect(baselineWidth({ median: 100, range: [100, 100] })).toBe(5);
    expect(deviation(90, { median: 100, range: [95, 105] })).toBe(-1);
  });

  it('computeBaselines skips indicators without enough data', () => {
    const rs = [1, 2, 3, 4, 5].map((v, i) => reading('mood', v, i * 60));
    expect(Object.keys(computeBaselines(rs, ['mood', 'stress']))).toEqual(['mood']);
  });

  it('leaves acute episodes out: flagged monitor readings, bursts and MAD outliers', () => {
    // 30 hourly readings around 68 bpm, then a 10-minute emergency with a monitor stream.
    const daily = Array.from({ length: 30 }, (_, i) =>
      reading('heart-rate', 66 + (i % 5), (40 - i) * 60),
    );
    const burst = Array.from({ length: 12 }, (_, i) => reading('heart-rate', 120 + i * 4, 10 - i));
    const monitor = Array.from({ length: 20 }, (_, i) =>
      reading('heart-rate', 168, 5 - i * 0.25, { source: 'watch', note: 'emergency-monitor' }),
    );
    const b = computeBaseline([...daily, ...burst, ...monitor], 'heart-rate');
    expect(b?.range[1]).toBeLessThanOrEqual(71);
    const off = computeBaseline([...daily, ...burst, ...monitor], 'heart-rate', {
      excludeAcute: false,
      minSpacingMin: 0,
      outlierZ: Number.POSITIVE_INFINITY,
    });
    expect(off?.range[1]).toBeGreaterThan(150);
  });

  it('a single far outlier is dropped; a slow drift is kept', () => {
    const steady = [70, 71, 69, 70, 72, 68, 70, 71, 69, 70].map((v, i) =>
      reading('hrv', v, (20 - i) * 60),
    );
    const spike = reading('hrv', 140, 60);
    expect(computeBaseline([...steady, spike], 'hrv')?.range[1]).toBeLessThan(75);
    const drift = Array.from({ length: 30 }, (_, i) =>
      reading('reaction-time', 270 + i, (31 - i) * 1440),
    );
    expect(computeBaseline(drift, 'reaction-time')).toEqual({
      median: 284.5,
      range: [272.9, 296.1],
    });
  });

  it('MAD 0 skips the outlier step (rare normal values are kept)', () => {
    const mood = [4, 4, 4, 4, 4, 4, 5, 4, 4, 5].map((v, i) => reading('mood', v, (20 - i) * 1440));
    expect(computeBaseline(mood, 'mood')?.range[1]).toBe(5);
  });
});
