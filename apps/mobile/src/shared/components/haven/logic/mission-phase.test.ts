import { describe, expect, it } from 'vitest';
import { hasDay, missionPhase, missionPhaseText } from './mission-phase';

const texts = {
  day: 'Day {n}',
  preparing: 'Being prepared',
  startsOn: 'Starts on {date}',
  finishedDay: 'Finished · day {n}',
};
const date = (iso: string) => `<${iso}>`;

describe('mission phase', () => {
  it('maps Earth states; absent status is a running mission', () => {
    expect(missionPhase({ status: 'planned', day: 0 })).toEqual({ kind: 'preparing' });
    expect(missionPhase({ status: 'scheduled', day: 0, start: '2026-12-03' })).toEqual({
      kind: 'scheduled',
      start: '2026-12-03',
    });
    expect(missionPhase({ status: 'scheduled', day: 0 })).toEqual({ kind: 'preparing' });
    expect(missionPhase({ status: 'active', day: 12 })).toEqual({ kind: 'running', day: 12 });
    expect(missionPhase({ day: 142 })).toEqual({ kind: 'running', day: 142 });
    expect(missionPhase({ status: 'finished', day: 540 })).toEqual({ kind: 'finished', day: 540 });
  });

  it('only running and finished missions have a day', () => {
    expect(hasDay(missionPhase({ status: 'planned', day: 0 }))).toBe(false);
    expect(hasDay(missionPhase({ status: 'finished', day: 3 }))).toBe(true);
  });

  it('writes one short line per phase', () => {
    const line = (m: Parameters<typeof missionPhase>[0]) =>
      missionPhaseText(missionPhase(m), texts, date);
    expect(line({ status: 'planned', day: 0 })).toBe('Being prepared');
    expect(line({ status: 'scheduled', day: 0, start: '2026-12-03' })).toBe(
      'Starts on <2026-12-03>',
    );
    expect(line({ status: 'active', day: 1 })).toBe('Day 1');
    expect(line({ status: 'finished', day: 540 })).toBe('Finished · day 540');
  });
});
