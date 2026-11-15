import { balanceReading, loadConfig, motionReading } from '@haven/core';
import { describe, expect, it } from 'vitest';
import { motionRow } from './motion';

const { environments } = loadConfig();
const NOW = new Date('2026-03-10T15:00:00Z');
const member = { id: 'omar', name: 'Omar', lastDataAt: null, noRecentData: false };
const opts = (takenAt: string) => ({ crewMember: 'omar', takenAt, newId: () => takenAt });
const LUNAR = [
  { environment: 'launch', days: 1 },
  { environment: 'transit', days: 3 },
  { environment: 'moon', days: 10 },
];

describe('motionRow', () => {
  it('shows the recent score, the window on arrival and the balance test on the surface', () => {
    const readings = [
      motionReading(5, opts('2026-03-09T09:00:00Z')),
      motionReading(7, opts('2026-03-10T09:00:00Z')),
      balanceReading({ open: 10, closed: 30 }, opts('2026-03-10T10:00:00Z')),
    ];
    const row = motionRow(
      member,
      readings,
      { day: 6, environment: 'moon', phases: LUNAR },
      environments,
      NOW,
    );
    expect(row.latest).toMatchObject({ score: 7, level: 'red' });
    expect(row.window).toMatchObject({ open: true, reason: 'transition', day: 2 });
    expect(row.checkDue).toBe(false);
    expect(row.surface).toBe(true);
    expect(row.balance).toMatchObject({ closed: 30, ratio: 3, level: 'amber' });
    expect(row.days.at(-1)).toEqual({ day: '2026-03-10', score: 7 });
  });

  it('drops an old score and asks for today’s while the window is open', () => {
    const row = motionRow(
      member,
      [motionReading(4, opts('2026-03-07T09:00:00Z'))],
      { day: 2, environment: 'transit' },
      environments,
      NOW,
    );
    expect(row.latest).toBeUndefined();
    expect(row.checkDue).toBe(true);
    expect(row.surface).toBe(false);
  });
});
