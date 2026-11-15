import { describe, expect, it } from 'vitest';
import { workload } from '../config';
import type { Reading } from '../contracts';
import {
  dayHoursLevel,
  fatigueLevel,
  fatigueReading,
  parseWorkHours,
  type WorkDay,
  workDays,
  workHoursReading,
  workloadStatus,
} from './workload';

const NOW = new Date('2026-03-10T20:00:00Z');
let n = 0;
const opts = (takenAt: string) => ({ crewMember: 'ana', takenAt, newId: () => `r${n++}` });

/**
 * A 7-day week from hours, fatigue and sleep per day; shorter lists are the
 * last days of the week and the earlier days have no log.
 */
const week = (
  hours: (number | null)[],
  fatigue: (number | null)[] = [],
  sleep: (number | null)[] = [],
): WorkDay[] => {
  const pad = 7 - hours.length;
  return Array.from({ length: 7 }, (_, i) => ({
    day: `2026-03-${String(i + 4).padStart(2, '0')}`,
    hours: hours[i - pad] ?? null,
    fatigue: fatigue[i - pad] ?? null,
    sleep: sleep[i - pad] ?? null,
  }));
};

describe('work days', () => {
  it('takes the hours, the worst fatigue and the sleep of each UTC day', () => {
    const sleep: Reading = {
      id: 's',
      indicator: 'sleep',
      value: 5.5,
      unit: 'h',
      takenAt: '2026-03-10T06:00:00Z',
      source: 'watch',
      simulated: false,
      crewMember: 'ana',
    };
    const readings = [
      workHoursReading(9, opts('2026-03-09T19:00:00Z')),
      workHoursReading(11, opts('2026-03-10T19:00:00Z')),
      fatigueReading(3, opts('2026-03-10T12:00:00Z')),
      fatigueReading(5, opts('2026-03-10T19:30:00Z')),
      sleep,
    ];
    const days = workDays(readings, NOW, 2);
    expect(days).toEqual([
      { day: '2026-03-09', hours: 9, fatigue: null, sleep: null },
      { day: '2026-03-10', hours: 11, fatigue: 5, sleep: 5.5 },
    ]);
  });

  it('grades fatigue and the length of a day', () => {
    expect([1, 4, 5, 6, 7].map((s) => fatigueLevel(s, workload))).toEqual([
      'green',
      'green',
      'amber',
      'red',
      'red',
    ]);
    expect([8, 10, 10.5, 12.5].map((h) => dayHoursLevel(h, workload))).toEqual([
      'green',
      'green',
      'amber',
      'red',
    ]);
  });
});

describe('workload status', () => {
  it('is green with a normal week and a rest day', () => {
    const s = workloadStatus(week([8, 9, 3, 8.5, 9, 8, 7], [2, 3]), workload);
    expect(s).toMatchObject({
      level: 'green',
      reasons: [],
      weekHours: 52.5,
      loggedDays: 7,
      restDays: 1,
      longStreak: 0,
      latestFatigue: 3,
    });
  });

  it('warns about long days in a row, a full week without rest and a heavy week', () => {
    const s = workloadStatus(week([9, 9, 8, 9, 11, 11, 11]), workload);
    expect(s.level).toBe('amber');
    expect(workloadStatus(week([10, 10, 10, 10, 10, 10, 10]), workload).level).toBe('red');
    expect(s.reasons).toEqual(['week-hours', 'long-streak', 'no-rest']);
    expect(s.longStreak).toBe(3);
    expect(workloadStatus(week([8, 13, 9, null, null]), workload).reasons).toEqual(['over-max']);
  });

  it('turns high fatigue red after a short night', () => {
    const tired = workloadStatus(week([8, 8], [null, 5], [null, 7]), workload);
    expect(tired).toMatchObject({ level: 'amber', reasons: ['fatigue'] });
    const short = workloadStatus(week([8, 8], [null, 5], [null, 5]), workload);
    expect(short).toMatchObject({ level: 'red', reasons: ['fatigue-short-sleep'] });
    expect(workloadStatus(week([8], [6]), workload).reasons).toEqual(['fatigue']);
    expect(workloadStatus(week([8], [6]), workload).level).toBe('red');
  });

  it('is pending without any log and averages the sleep it has', () => {
    expect(workloadStatus(week([null, null]), workload).level).toBe('pending');
    expect(workloadStatus(week([8, 8], [], [6, 7.5]), workload).averageSleep).toBe(6.8);
  });
});

describe('parseWorkHours', () => {
  it('accepts 0–24 in half hours, with a comma or a dot', () => {
    expect(parseWorkHours('9')).toBe(9);
    expect(parseWorkHours('9,5')).toBe(9.5);
    expect(parseWorkHours('0')).toBe(0);
    expect(parseWorkHours('9.3')).toBeUndefined();
    expect(parseWorkHours('25')).toBeUndefined();
    expect(parseWorkHours('')).toBeUndefined();
  });
});
