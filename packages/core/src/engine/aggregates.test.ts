import { describe, expect, it } from 'vitest';
import { crewAggregates } from './aggregates';
import { reading } from './test-fixtures';

describe('crewAggregates', () => {
  const day = (crewMember: string, v: number, minutesAgo = 0) =>
    reading('sleep', v, minutesAgo, { crewMember });

  it('null with fewer than 3 crew members with data', () => {
    expect(crewAggregates({ a: [day('a', 7)], b: [day('b', 6)], c: [] }, 'sleep')).toBeNull();
  });

  it('per-person daily mean first, then crew mean; drops days with < 3 people', () => {
    const res = crewAggregates(
      {
        a: [day('a', 6), day('a', 8)],
        b: [day('b', 6)],
        c: [day('c', 7), day('c', 5, 24 * 60)],
      },
      'sleep',
    );
    expect(res).toEqual([{ date: '2026-11-14', mean: 6.667 }]);
  });
});
