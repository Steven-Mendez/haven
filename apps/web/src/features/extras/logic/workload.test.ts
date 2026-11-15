import { fatigueReading, workHoursReading } from '@haven/core';
import { describe, expect, it } from 'vitest';
import { workloadRow } from './workload';

const NOW = new Date('2026-03-10T20:00:00Z');
const member = { id: 'ana', name: 'Ana', lastDataAt: null, noRecentData: false };
const opts = (takenAt: string) => ({ crewMember: 'ana', takenAt, newId: () => takenAt });

describe('workloadRow', () => {
  it('builds the week and its status from the readings', () => {
    const readings = ['04', '05', '06', '07', '08', '09', '10'].map((d) =>
      workHoursReading(11, opts(`2026-03-${d}T19:00:00Z`)),
    );
    const row = workloadRow(
      member,
      [...readings, fatigueReading(5, opts('2026-03-10T19:30:00Z'))],
      NOW,
    );
    expect(row.days).toHaveLength(7);
    expect(row.status).toMatchObject({
      level: 'red',
      weekHours: 77,
      longStreak: 7,
      latestFatigue: 5,
    });
    expect(row.status.reasons).toEqual(['week-hours', 'long-streak', 'no-rest', 'fatigue']);
  });

  it('is pending without logs', () => {
    expect(workloadRow(member, [], NOW).status.level).toBe('pending');
  });
});
