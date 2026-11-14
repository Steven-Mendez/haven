import type { Assessment, Reading } from '@haven/core';
import { describe, expect, it } from 'vitest';
import { baselineCoverage, daysOfData, levelCounts, readingStreak } from './profile';

const NOW = new Date(2026, 10, 1, 12).getTime();
const DAY = 86_400_000;

function reading(ms: number): Reading {
  return {
    id: `r${ms}`,
    indicator: 'heart-rate',
    value: 60,
    unit: 'bpm',
    takenAt: new Date(ms).toISOString(),
    source: 'manual',
    crewMember: 'elena-vega',
  } as Reading;
}

function assessment(level: Assessment['level'], baseline = false): Assessment {
  return {
    indicator: `i-${Math.random()}`,
    level,
    baseline: baseline ? { median: 1, range: [0, 2] } : undefined,
    explanation: { es: '', en: '' },
    actions: [],
    ageMin: 0,
    simulated: false,
  };
}

describe('profile summary', () => {
  it('counts levels and baseline coverage', () => {
    const list = [assessment('green', true), assessment('green'), assessment('amber', true)];
    expect(levelCounts(list)).toEqual({ red: 0, amber: 1, pending: 0, green: 2 });
    expect(baselineCoverage(list)).toEqual({ ready: 2, total: 3 });
  });

  it('measures days of data since the first reading', () => {
    expect(daysOfData([], NOW)).toBe(0);
    expect(daysOfData([reading(NOW - 2 * DAY - 1000), reading(NOW)], NOW)).toBe(3);
  });

  it('counts the reading streak ending today or yesterday', () => {
    const today = [
      reading(NOW),
      reading(NOW - DAY),
      reading(NOW - 2 * DAY),
      reading(NOW - 4 * DAY),
    ];
    expect(readingStreak(today, NOW)).toBe(3);
    expect(readingStreak([reading(NOW - DAY), reading(NOW - 2 * DAY)], NOW)).toBe(2);
    expect(readingStreak([reading(NOW - 3 * DAY)], NOW)).toBe(0);
  });
});
