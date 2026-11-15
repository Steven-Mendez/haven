import { medications } from '@haven/core';
import { describe, expect, it } from 'vitest';
import { parsePlanResponse } from './plan';

const who = { mission: 'DEMORE', crewMember: 'ana' };
const body = {
  ...who,
  medications: [{ medication: 'vitamin-d' }, { medication: 'unknown' }],
  updatedAt: '2026-11-14T10:00:00.000Z',
  author: 'Control',
};

describe('parsePlanResponse', () => {
  it('keeps a valid plan for the same crew member and drops unknown medications', () => {
    expect(parsePlanResponse(body, who, medications)).toEqual({
      ...who,
      medications: [{ medication: 'vitamin-d' }],
      updatedAt: '2026-11-14T10:00:00.000Z',
      author: 'Control',
    });
  });

  it('rejects plans for someone else or without a date', () => {
    expect(parsePlanResponse({ ...body, crewMember: 'otro' }, who, medications)).toBeUndefined();
    expect(parsePlanResponse({ ...body, updatedAt: 'x' }, who, medications)).toBeUndefined();
    expect(parsePlanResponse(null, who, medications)).toBeUndefined();
  });

  it('keeps a valid exercise prescription and drops one outside the limits', () => {
    const prescription = { resistanceMinutes: 60, aerobicMinutes: 30, daysPerWeek: 7 };
    expect(
      parsePlanResponse({ ...body, exercise: prescription }, who, medications)?.exercise,
    ).toEqual(prescription);
    expect(
      parsePlanResponse(
        { ...body, exercise: { ...prescription, daysPerWeek: 12 } },
        who,
        medications,
      ),
    ).not.toHaveProperty('exercise');
  });
});
