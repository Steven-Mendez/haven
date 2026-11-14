import type { Reading } from '@haven/core';
import { describe, expect, it } from 'vitest';
import { dedupe, isSameSample } from './dedupe';

const T = Date.parse('2026-11-01T10:00:00.000Z');
function r(id: string, source: Reading['source'], s: number, value: number | string = 72): Reading {
  return {
    id,
    indicator: 'heart-rate',
    value,
    unit: 'bpm',
    takenAt: new Date(T + s * 1000).toISOString(),
    source,
    simulated: false,
    crewMember: 'elena-vega',
  };
}

describe('isSameSample', () => {
  it('matches watch and HealthKit readings of the same moment and value', () => {
    expect(isSameSample(r('a', 'watch', 0), r('b', 'healthkit', 30, 72.4))).toBe(true);
  });

  it('does not match different values, far times, other sources or the same source', () => {
    expect(isSameSample(r('a', 'watch', 0), r('b', 'healthkit', 0, 80))).toBe(false);
    expect(isSameSample(r('a', 'watch', 0), r('b', 'healthkit', 600))).toBe(false);
    expect(isSameSample(r('a', 'simulator', 0), r('b', 'healthkit', 0))).toBe(false);
    expect(isSameSample(r('a', 'watch', 0), r('b', 'watch', 0))).toBe(false);
  });
});

describe('dedupe', () => {
  it('HealthKit arriving after the watch supersedes the watch reading', () => {
    expect(dedupe([r('hk', 'healthkit', 10)], [r('w', 'watch', 0)])).toEqual({
      save: [r('hk', 'healthkit', 10)],
      supersede: ['w'],
    });
  });

  it('the watch arriving after HealthKit is skipped', () => {
    expect(dedupe([r('w', 'watch', 10)], [r('hk', 'healthkit', 0)])).toEqual({
      save: [],
      supersede: [],
    });
  });

  it('twins in the same batch keep only HealthKit', () => {
    const result = dedupe([r('w', 'watch', 0), r('hk', 'healthkit', 5)], []);
    expect(result.save.map((x) => x.id)).toEqual(['hk']);
    expect(result.supersede).toEqual([]);
  });

  it('keeps unrelated readings untouched', () => {
    const result = dedupe([r('s', 'simulator', 0), r('m', 'manual', 0)], [r('hk', 'healthkit', 0)]);
    expect(result.save.map((x) => x.id)).toEqual(['s', 'm']);
  });
});
