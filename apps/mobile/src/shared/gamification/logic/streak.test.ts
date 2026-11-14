import { describe, expect, it } from 'vitest';

import { bestStreak, currentStreak, pendingMilestone, type StreakDay } from './streak';

const days = (spec: string, end = '2026-11-10'): StreakDay[] => {
  const endMs = Date.parse(`${end}T00:00:00.000Z`);
  return [...spec].map((c, i) => ({
    date: new Date(endMs - (spec.length - 1 - i) * 86_400_000).toISOString().slice(0, 10),
    complete: c === 'x',
  }));
};

describe('currentStreak', () => {
  it('counts back from yesterday and adds today only when complete', () => {
    expect(currentStreak(days('.xxx.'), '2026-11-10')).toBe(3);
    expect(currentStreak(days('.xxxx'), '2026-11-10')).toBe(4);
  });

  it('breaks on an incomplete past day', () => {
    expect(currentStreak(days('xx.x.'), '2026-11-10')).toBe(1);
  });

  it('an emergency (protected) day never breaks the streak', () => {
    expect(currentStreak(days('xx.x.'), '2026-11-10', ['2026-11-08'])).toBe(3);
  });

  it('a link-down day bridges without adding', () => {
    expect(currentStreak(days('x..x.'), '2026-11-10', ['2026-11-07', '2026-11-08'])).toBe(2);
  });
});

describe('bestStreak', () => {
  it('finds the longest run, bridged by protected days', () => {
    expect(bestStreak(days('xxx.xx.xxxx'))).toBe(4);
    expect(bestStreak(days('xxx.xx'), ['2026-11-08'])).toBe(5);
  });
});

describe('pendingMilestone', () => {
  it('celebrates a streak milestone once, on the day it is reached', () => {
    expect(pendingMilestone(7, 10, [])).toEqual({ kind: 'streak', value: 7, key: 'streak-7' });
    expect(pendingMilestone(7, 10, ['streak-7'])).toBeUndefined();
    expect(pendingMilestone(8, 10, [])).toBeUndefined();
  });

  it('celebrates mission-day milestones', () => {
    expect(pendingMilestone(2, 100, [])).toEqual({
      kind: 'mission',
      value: 100,
      key: 'mission-100',
    });
  });
});
