import { describe, expect, it } from 'vitest';
import { medications as cfg } from '../config';
import type { CrewPlan } from '../contracts';
import {
  adherence,
  asNeededToday,
  cleanAssignments,
  doseReading,
  dosesForDay,
  scheduledDoses,
} from './medication';

// Saturday 14 Nov 2026, 12:00 mission time.
const NOW = new Date('2026-11-14T12:00:00.000Z');
let n = 0;
const newId = () => `id${++n}`;
const opts = (takenAt: string) => ({ crewMember: 'ana', takenAt, newId });

const plan = (medications: CrewPlan['medications']): CrewPlan => ({
  mission: 'DEMO01',
  crewMember: 'ana',
  medications,
  updatedAt: NOW.toISOString(),
});

describe('medication config', () => {
  it('has bilingual catalog entries with unique ids and valid schedules', () => {
    const ids = cfg.catalog.map((m) => m.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const m of cfg.catalog) {
      for (const t of [m.name, m.purpose, m.instructions]) expect(t.es && t.en, m.id).toBeTruthy();
      expect(
        cleanAssignments([{ medication: m.id, schedule: m.schedule }], cfg)[0]?.schedule,
      ).toEqual(m.schedule);
    }
    expect(cfg.doseWindowHours).toBeGreaterThan(0);
  });
});

describe('scheduledDoses', () => {
  it('lists daily doses every day and weekly ones on their weekday', () => {
    const p = plan([{ medication: 'antibiotic' }, { medication: 'alendronate' }]);
    expect(scheduledDoses(p, cfg, '2026-11-14').map((d) => d.scheduledAt)).toEqual([
      '2026-11-14T08:00:00.000Z',
      '2026-11-14T20:00:00.000Z',
    ]);
    expect(scheduledDoses(p, cfg, '2026-11-16').map((d) => d.medication)).toEqual([
      'alendronate',
      'antibiotic',
      'antibiotic',
    ]);
  });

  it('stops after the end date and uses the schedule set by Earth', () => {
    const p = plan([
      { medication: 'antibiotic', until: '2026-11-13' },
      { medication: 'vitamin-d', schedule: { kind: 'daily', times: ['21:30'] } },
    ]);
    expect(scheduledDoses(p, cfg, '2026-11-14')).toEqual([
      { medication: 'vitamin-d', scheduledAt: '2026-11-14T21:30:00.000Z' },
    ]);
  });
});

describe('dosesForDay', () => {
  it('marks recorded, due, missed and upcoming doses', () => {
    const p = plan([
      { medication: 'vitamin-d' },
      { medication: 'antibiotic' },
      { medication: 'vitamin-b-complex', schedule: { kind: 'daily', times: ['11:00'] } },
    ]);
    const taken = doseReading(
      'vitamin-d',
      { status: 'taken', scheduledAt: '2026-11-14T08:00:00.000Z' },
      opts('2026-11-14T08:05:00.000Z'),
    );
    const doses = dosesForDay(p, cfg, [taken], NOW);
    expect(doses.map((d) => [d.medication, d.status])).toEqual([
      ['vitamin-d', 'taken'],
      ['antibiotic', 'missed'],
      ['vitamin-b-complex', 'due'],
      ['antibiotic', 'upcoming'],
    ]);
  });
});

describe('asNeededToday', () => {
  it('counts today’s doses against the daily maximum', () => {
    const p = plan([{ medication: 'motion-sickness' }, { medication: 'vitamin-d' }]);
    const rs = [
      doseReading('motion-sickness', { status: 'taken' }, opts('2026-11-13T22:00:00.000Z')),
      doseReading('motion-sickness', { status: 'taken' }, opts('2026-11-14T06:00:00.000Z')),
      doseReading('motion-sickness', { status: 'taken' }, opts('2026-11-14T10:00:00.000Z')),
    ];
    expect(asNeededToday(p, cfg, rs, NOW)).toEqual([
      { medication: 'motion-sickness', taken: 2, maxPerDay: 2, canTake: false },
    ]);
  });
});

describe('adherence', () => {
  it('counts closed doses of the last days and ignores the open ones', () => {
    const p = plan([{ medication: 'vitamin-d' }]);
    const rs = [
      doseReading(
        'vitamin-d',
        { status: 'taken', scheduledAt: '2026-11-14T08:00:00.000Z' },
        opts('2026-11-14T08:10:00.000Z'),
      ),
      doseReading(
        'vitamin-d',
        { status: 'skipped', scheduledAt: '2026-11-13T08:00:00.000Z' },
        opts('2026-11-13T08:10:00.000Z'),
      ),
    ];
    expect(adherence(p, cfg, rs, NOW, 3)).toEqual({
      expected: 3,
      taken: 1,
      skipped: 1,
      missed: 1,
      percent: 33,
    });
    expect(adherence(plan([]), cfg, rs, NOW).percent).toBeNull();
  });
});

describe('cleanAssignments', () => {
  it('drops unknown or repeated medications and invalid fields', () => {
    expect(
      cleanAssignments(
        [
          { medication: 'vitamin-d', until: '2026-12-01', note: '  con agua  ' },
          { medication: 'vitamin-d' },
          { medication: 'nope' },
          { medication: 'antibiotic', schedule: { kind: 'daily', times: ['25:00'] }, until: 'x' },
          'garbage',
        ],
        cfg,
      ),
    ).toEqual([
      { medication: 'vitamin-d', until: '2026-12-01', note: 'con agua' },
      { medication: 'antibiotic' },
    ]);
    expect(cleanAssignments(null, cfg)).toEqual([]);
  });
});
