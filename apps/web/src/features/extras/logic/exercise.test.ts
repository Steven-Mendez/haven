import { assessmentReading, exercise, type Reading } from '@haven/core';
import { describe, expect, it } from 'vitest';
import { exerciseRow, formInt } from './exercise';

const NOW = new Date('2026-03-10T15:00:00Z');
const member = { id: 'ines', name: 'Inés', lastDataAt: null, noRecentData: false };

const minutes = (indicator: string, value: number, takenAt: string): Reading => ({
  id: `${indicator}-${takenAt}`,
  indicator,
  value,
  unit: 'min',
  takenAt,
  source: 'manual',
  simulated: false,
  crewMember: 'ines',
});

const fullDay = (day: string) => [
  minutes('resistance-exercise', 45, `${day}T09:00:00Z`),
  minutes('aerobic-exercise', 45, `${day}T10:00:00Z`),
];

describe('exerciseRow', () => {
  it('measures the week against the default prescription from the first data', () => {
    const readings = ['2026-03-05', '2026-03-06', '2026-03-07', '2026-03-08', '2026-03-09'].flatMap(
      fullDay,
    );
    const row = exerciseRow(member, {}, readings, NOW);
    expect(row.custom).toBe(false);
    expect(row.prescription).toEqual(exercise.prescription);
    expect(row.compliance).toMatchObject({ met: 5, counted: 5, level: 'green' });
    expect(row.week[0]?.status).toBe('before');
    expect(row.today).toEqual({ resistance: 0, aerobic: 0 });
    expect(row.assessment).toBeUndefined();
    expect(row.assessmentDue).toBe(false);
  });

  it('uses Earth’s prescription and carries the suggestion of the last self-assessment', () => {
    const readings = [
      ...fullDay('2026-03-01'),
      assessmentReading(
        { effort: 9, pain: 'mild', completion: 'partial' },
        { crewMember: 'ines', takenAt: '2026-03-02T10:00:00Z', newId: () => 'a' },
      ),
    ];
    const custom = { resistanceMinutes: 30, aerobicMinutes: 30, daysPerWeek: 5 };
    const row = exerciseRow(member, { exercise: custom }, readings, NOW);
    expect(row.custom).toBe(true);
    expect(row.prescription).toBe(custom);
    expect(row.suggestion).toBe('lower');
    expect(row.assessmentDue).toBe(true);
  });

  it('has nothing to measure for a crew member without data', () => {
    const row = exerciseRow(member, {}, [], NOW);
    expect(row.compliance.level).toBe('pending');
    expect(row.assessmentDue).toBe(false);
  });
});

describe('formInt', () => {
  it('reads whole numbers and rejects the rest', () => {
    expect(formInt(' 45 ')).toBe(45);
    expect(formInt('4.5')).toBeNaN();
    expect(formInt('')).toBeNaN();
    expect(formInt(null)).toBeNaN();
  });
});
