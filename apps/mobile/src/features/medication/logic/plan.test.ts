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
});
