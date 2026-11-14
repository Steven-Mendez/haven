import { loadConfig } from '@haven/core';
import { describe, expect, it } from 'vitest';
import { latestTakenAt, nextDailyAction } from './next-action';

const config = loadConfig();
const all = (value: number) => config.zones.map((z) => ({ zone: z.id, progress: value }));

describe('nextDailyAction', () => {
  it('is undefined when every daily action is done', () => {
    expect(nextDailyAction(all(1), [], config)).toBeUndefined();
  });

  it('picks the worst zone first, then config order', () => {
    const progress = all(0);
    const next = nextDailyAction(
      progress,
      [
        { zone: 'heart', level: 'green' },
        { zone: 'lungs', level: 'green' },
        { zone: 'metabolism', level: 'amber' },
      ],
      config,
    );
    // Zones without a level are pending, which ranks above green but below amber.
    expect(next?.zone.id).toBe('metabolism');
  });

  it('opens an indicator when the daily action names one, else a screen', () => {
    const onlyHeart = all(1).map((p) => (p.zone === 'heart' ? { ...p, progress: 0 } : p));
    const heart = nextDailyAction(onlyHeart, [], config);
    expect(heart?.target).toEqual({ kind: 'indicator', id: 'systolic-bp' });
    const onlyMind = all(1).map((p) => (p.zone === 'mind' ? { ...p, progress: 0.5 } : p));
    expect(nextDailyAction(onlyMind, [], config)?.target).toEqual({
      kind: 'screen',
      id: config.zones.find((z) => z.id === 'mind')?.dailyAction.opens,
    });
  });
});

describe('latestTakenAt', () => {
  it('returns the newest timestamp or undefined', () => {
    expect(latestTakenAt([])).toBeUndefined();
    expect(
      latestTakenAt([{ takenAt: '2026-11-01T10:00:00Z' }, { takenAt: '2026-11-01T11:00:00Z' }]),
    ).toBe('2026-11-01T11:00:00Z');
  });
});
