import { loadConfig } from '@haven/core';
import { describe, expect, it } from 'vitest';
import { firstRunSteps } from './first-run';
import { nextDailyAction } from './next-action';

const config = loadConfig();
const next = nextDailyAction(
  [],
  config.zones.map((z) => ({ zone: z.id, progress: 0 })),
  config,
  new Date('2026-11-01T12:00:00.000Z'),
);
const crew = [{ id: 'ana-ruiz' }, { id: 'leo-park' }];

describe('firstRunSteps', () => {
  it('offers measuring first, then sources, while there are no readings', () => {
    const steps = firstRunSteps({ readings: 0, next, crew, crewMember: 'ana-ruiz' });
    expect(steps.map((s) => s.id)).toEqual(['measure', 'sources']);
  });

  it('asks who uses the phone when the crew member is not on the roster', () => {
    const steps = firstRunSteps({ readings: 0, next, crew, crewMember: 'elena-vega' });
    expect(steps.map((s) => s.id)).toEqual(['measure', 'sources', 'who']);
    expect(
      firstRunSteps({ readings: 0, next, crew: [], crewMember: 'x' }).map((s) => s.id),
    ).toEqual(['measure', 'sources']);
  });

  it('skips measuring when the day has nothing left, and hides once any reading exists', () => {
    expect(
      firstRunSteps({ readings: 0, next: undefined, crew, crewMember: 'ana-ruiz' }).map(
        (s) => s.id,
      ),
    ).toEqual(['sources']);
    expect(firstRunSteps({ readings: 1, next, crew, crewMember: 'elena-vega' })).toEqual([]);
  });
});
