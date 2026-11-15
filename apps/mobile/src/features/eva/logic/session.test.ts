import { describe, expect, it } from 'vitest';
import { sessionProgress } from './session';

const NOW = new Date('2026-11-14T12:00:00.000Z');
const startedAt = (minutesAgo: number) =>
  new Date(NOW.getTime() - minutesAgo * 60_000).toISOString();

describe('sessionProgress', () => {
  it('counts down the method minutes from the start', () => {
    expect(sessionProgress({ startedAt: startedAt(40) }, { minutes: 100 }, NOW)).toEqual({
      elapsedSec: 2400,
      remainingSec: 3600,
      totalSec: 6000,
      complete: false,
    });
  });

  it('is complete once the minutes have passed and never goes negative', () => {
    const p = sessionProgress({ startedAt: startedAt(130) }, { minutes: 120 }, NOW);
    expect(p).toMatchObject({ remainingSec: 0, complete: true });
  });

  it('treats a start in the future as just started', () => {
    expect(sessionProgress({ startedAt: startedAt(-5) }, { minutes: 15 }, NOW).elapsedSec).toBe(0);
  });
});
