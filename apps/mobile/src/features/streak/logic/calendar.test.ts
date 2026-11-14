import { describe, expect, it } from 'vitest';

import { dayStatus, daysOfMonth, monthGrid, nextMilestone, shiftMonth } from './calendar';

describe('shiftMonth', () => {
  it('moves across years', () => {
    expect(shiftMonth('2026-01', -1)).toBe('2025-12');
    expect(shiftMonth('2026-12', 1)).toBe('2027-01');
  });
});

describe('daysOfMonth', () => {
  it('knows month lengths', () => {
    expect(daysOfMonth('2026-02')).toHaveLength(28);
    expect(daysOfMonth('2028-02')).toHaveLength(29);
    expect(daysOfMonth('2026-11').at(-1)).toBe('2026-11-30');
  });
});

describe('monthGrid', () => {
  it('starts on Sunday in English', () => {
    const grid = monthGrid('2026-11', 0);
    expect(grid[0][0]).toBe('2026-11-01');
    expect(grid.every((w) => w.length === 7)).toBe(true);
  });

  it('starts on Monday in Spanish', () => {
    const grid = monthGrid('2026-11', 1);
    expect(grid[0].slice(0, 7)).toEqual([null, null, null, null, null, null, '2026-11-01']);
    expect(grid.at(-1)?.[0]).toBe('2026-11-30');
  });
});

describe('dayStatus', () => {
  const safe = new Set(['2026-11-03']);
  const s = (date: string, complete = false) =>
    dayStatus(date, '2026-11-10', complete, safe, '2026-11-02');

  it('reads each kind of day', () => {
    expect(s('2026-11-12')).toBe('future');
    expect(s('2026-11-05', true)).toBe('complete');
    expect(s('2026-11-03')).toBe('protected');
    expect(s('2026-11-10')).toBe('open');
    expect(s('2026-11-10', true)).toBe('complete');
    expect(s('2026-11-04')).toBe('missed');
    expect(s('2026-11-01')).toBe('none');
  });
});

describe('nextMilestone', () => {
  it('gives the next goal and the days left', () => {
    expect(nextMilestone(4, [7, 14, 30])).toEqual({ value: 7, left: 3 });
    expect(nextMilestone(7, [7, 14, 30])).toEqual({ value: 14, left: 7 });
    expect(nextMilestone(40, [7, 14, 30])).toBeUndefined();
  });
});
