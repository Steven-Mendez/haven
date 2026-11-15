import { describe, expect, it } from 'vitest';
import { comms } from '../config';
import { actsAlone, commsMode, linkTimes } from './comms';

describe('comms mode', () => {
  it('is live with the Moon, delayed for minutes and autonomous with Mars', () => {
    const mode = (currentDelayMin: number, linkDown = false) =>
      commsMode({ currentDelayMin, linkDown }, comms);
    expect(mode(0)).toBe('realtime');
    expect(mode(0.0213)).toBe('realtime');
    expect(mode(1)).toBe('delayed');
    expect(mode(4.9)).toBe('delayed');
    expect(mode(5)).toBe('autonomous');
    expect(mode(22)).toBe('autonomous');
    expect(mode(0, true)).toBe('offline');
    expect(
      ['realtime', 'delayed', 'autonomous', 'offline'].map((m) => actsAlone(m as never)),
    ).toEqual([false, false, true, true]);
  });

  it('adds one trip to arrive and two for the earliest reply', () => {
    expect(linkTimes(new Date('2026-03-10T10:00:00Z'), 12)).toEqual({
      arrivesAt: '2026-03-10T10:12:00.000Z',
      replyAt: '2026-03-10T10:24:00.000Z',
    });
    expect(linkTimes(new Date('2026-03-10T10:00:00Z'), -1).replyAt).toBe(
      '2026-03-10T10:00:00.000Z',
    );
  });
});
