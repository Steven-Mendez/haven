import { describe, expect, it } from 'vitest';
import { exercise } from '../config';
import type { Reading } from '../contracts';
import {
  assessmentDue,
  assessmentReading,
  assessmentSuggestion,
  cleanPrescription,
  dayMinutes,
  EXERCISE_ASSESSMENT_INDICATOR,
  exerciseCompliance,
  exerciseWeek,
  latestAssessment,
  prescriptionOf,
  sessionReading,
} from './exercise';

const NOW = new Date('2026-03-10T15:00:00Z');
const P = { resistanceMinutes: 45, aerobicMinutes: 45, daysPerWeek: 6 };

let n = 0;
const opts = (takenAt: string) => ({ crewMember: 'ines', takenAt, newId: () => `r${n++}` });

function minutes(indicator: string, value: number, takenAt: string): Reading {
  return {
    id: `${indicator}-${takenAt}-${value}`,
    indicator,
    value,
    unit: 'min',
    takenAt,
    source: 'manual',
    simulated: false,
    crewMember: 'ines',
  };
}

/** Both kinds done on a day (YYYY-MM-DD). */
const fullDay = (day: string, res = 45, aer = 45) => [
  minutes('resistance-exercise', res, `${day}T09:00:00Z`),
  minutes('aerobic-exercise', aer, `${day}T10:00:00Z`),
];

describe('exercise prescription', () => {
  it('uses the plan when Earth set one and the config default otherwise', () => {
    expect(prescriptionOf(undefined, exercise)).toEqual(exercise.prescription);
    const custom = { ...P, aerobicMinutes: 30 };
    expect(prescriptionOf({ exercise: custom }, exercise)).toBe(custom);
  });

  it('cleans untrusted input inside the limits', () => {
    expect(cleanPrescription({ ...P, note: '  more cycling  ' }, exercise)).toEqual({
      ...P,
      note: 'more cycling',
    });
    expect(cleanPrescription({ ...P, daysPerWeek: 9 }, exercise)).toBeUndefined();
    expect(cleanPrescription({ ...P, aerobicMinutes: 30.5 }, exercise)).toBeUndefined();
    expect(cleanPrescription({ ...P, resistanceMinutes: '45' }, exercise)).toBeUndefined();
    expect(
      cleanPrescription({ ...P, resistanceMinutes: 0, aerobicMinutes: 0 }, exercise),
    ).toBeUndefined();
    expect(cleanPrescription(null, exercise)).toBeUndefined();
  });
});

describe('exercise days', () => {
  it('adds the sessions of a UTC day and counts the HealthKit running total once', () => {
    const synced = (value: number, takenAt: string): Reading => ({
      ...minutes('aerobic-exercise', value, takenAt),
      source: 'healthkit',
    });
    const readings = [
      minutes('resistance-exercise', 20, '2026-03-10T08:00:00Z'),
      minutes('resistance-exercise', 25, '2026-03-10T12:00:00Z'),
      synced(20, '2026-03-10T13:00:00Z'),
      synced(30, '2026-03-10T14:00:00Z'),
      minutes('aerobic-exercise', 10, '2026-03-10T15:00:00Z'),
      minutes('aerobic-exercise', 90, '2026-03-09T13:00:00Z'),
    ];
    expect(dayMinutes(readings, '2026-03-10')).toEqual({ resistance: 45, aerobic: 40 });
  });

  it('a session reading carries its own minutes and device', () => {
    const r = sessionReading(
      'aerobic',
      { minutes: 20, device: 'cycle' },
      opts('2026-03-10T12:00:00Z'),
    );
    expect(r).toMatchObject({ indicator: 'aerobic-exercise', value: 20, unit: 'min' });
    expect(r.note).toBe('device=cycle');
    expect(
      sessionReading('resistance', { minutes: 5 }, opts('2026-03-10T12:00:00Z')).note,
    ).toBeUndefined();
  });

  it('labels the week: met, partial, rest, today still open and days before the first data', () => {
    const readings = [
      ...fullDay('2026-03-05'),
      minutes('resistance-exercise', 45, '2026-03-06T09:00:00Z'),
      ...fullDay('2026-03-08'),
      ...fullDay('2026-03-09'),
      minutes('aerobic-exercise', 10, '2026-03-10T09:00:00Z'),
    ];
    const week = exerciseWeek(readings, P, NOW, '2026-03-05T08:00:00Z');
    expect(week.map((d) => d.day)).toEqual([
      '2026-03-04',
      '2026-03-05',
      '2026-03-06',
      '2026-03-07',
      '2026-03-08',
      '2026-03-09',
      '2026-03-10',
    ]);
    expect(week.map((d) => d.status)).toEqual([
      'before',
      'met',
      'partial',
      'rest',
      'met',
      'met',
      'open',
    ]);
  });

  it('a prescription with less aerobic is met with less aerobic', () => {
    const week = exerciseWeek(
      fullDay('2026-03-10', 45, 30),
      { ...P, aerobicMinutes: 30 },
      NOW,
      '2026-03-01',
    );
    expect(week.at(-1)?.status).toBe('met');
  });
});

describe('exercise compliance', () => {
  const since = '2026-03-01T00:00:00Z';
  const days = ['2026-03-04', '2026-03-05', '2026-03-06', '2026-03-07', '2026-03-08', '2026-03-09'];

  it('one rest day in seven is green with six days a week', () => {
    const readings = days.slice(1).flatMap((d) => fullDay(d));
    const c = exerciseCompliance(exerciseWeek(readings, P, NOW, since), P);
    expect(c).toEqual({ counted: 6, met: 5, target: 5, level: 'green' });
  });

  it('is amber one day short and red two or more', () => {
    const one = days.slice(2).flatMap((d) => fullDay(d));
    expect(exerciseCompliance(exerciseWeek(one, P, NOW, since), P).level).toBe('amber');
    const two = days.slice(3).flatMap((d) => fullDay(d));
    expect(exerciseCompliance(exerciseWeek(two, P, NOW, since), P).level).toBe('red');
  });

  it('counts today once it is met, and nothing before the first data', () => {
    const readings = fullDay('2026-03-10');
    const c = exerciseCompliance(exerciseWeek(readings, P, NOW, '2026-03-10T08:00:00Z'), P);
    expect(c).toEqual({ counted: 1, met: 1, target: 0, level: 'green' });
    const none = exerciseCompliance(exerciseWeek([], P, NOW, '2026-03-10T08:00:00Z'), P);
    expect(none.level).toBe('pending');
  });
});

describe('exercise self-assessment', () => {
  const a = (effort: number, pain = 'none', completion = 'full', at = '2026-03-08T10:00:00Z') => ({
    ...assessmentReading(
      { effort, pain: pain as 'none', completion: completion as 'full' },
      opts(at),
    ),
  });

  it('reads the latest one from its reading', () => {
    const latest = latestAssessment([a(5), a(7, 'mild', 'partial', '2026-03-09T10:00:00Z')]);
    expect(latest).toEqual({
      effort: 7,
      pain: 'mild',
      completion: 'partial',
      at: '2026-03-09T10:00:00Z',
    });
    expect(a(5).indicator).toBe(EXERCISE_ASSESSMENT_INDICATOR);
    expect(latestAssessment([])).toBeUndefined();
  });

  it('is due a week after the last one, or after the first data', () => {
    const latest = latestAssessment([a(5, 'none', 'full', '2026-03-03T15:00:00Z')]);
    expect(assessmentDue(latest, exercise, NOW)).toBe(true);
    expect(assessmentDue(latestAssessment([a(5)]), exercise, NOW)).toBe(false);
    expect(assessmentDue(undefined, exercise, NOW, '2026-03-02T00:00:00Z')).toBe(true);
    expect(assessmentDue(undefined, exercise, NOW, '2026-03-08T00:00:00Z')).toBe(false);
    expect(assessmentDue(undefined, exercise, NOW)).toBe(false);
  });

  it('suggests raising an easy, complete and painless week and lowering a hard one', () => {
    const s = (effort: number, pain = 'none', completion = 'full') =>
      assessmentSuggestion(latestAssessment([a(effort, pain, completion)]) as never, exercise);
    expect(s(2)).toBe('raise');
    expect(s(5)).toBe('keep');
    expect(s(2, 'mild')).toBe('keep');
    expect(s(9)).toBe('lower');
    expect(s(5, 'strong')).toBe('lower');
    expect(s(5, 'none', 'none')).toBe('lower');
  });
});
