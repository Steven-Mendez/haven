import { dailyProgress, loadConfig, type Reading } from '@haven/core';
import { describe, expect, it } from 'vitest';
import { latestTakenAt, nextDailyAction } from './next-action';

const config = loadConfig();
const now = new Date('2026-11-01T12:00:00.000Z');
const at = '2026-11-01T09:00:00.000Z';
let n = 0;
const reading = (indicator: string, value: number | string, source: Reading['source'] = 'manual') =>
  ({
    id: `r${n++}`,
    indicator,
    value,
    unit: '',
    takenAt: at,
    source,
    simulated: false,
    crewMember: 'elena-vega',
  }) satisfies Reading;
const next = (readings: Reading[]) =>
  nextDailyAction(readings, dailyProgress(readings, config, now), config, now);

const battery = ['reaction-time', 'pvt-lapses', 'working-memory', 'go-nogo-accuracy'].map((i) =>
  reading(i, 1, 'screen'),
);
const checkin = [reading('mood', 4, 'screen'), reading('stress', 2, 'screen')];

describe('nextDailyAction', () => {
  it('follows the routine order: games, then the check-in, then the values to type in', () => {
    expect(next([])).toMatchObject({
      zone: { id: 'performance' },
      target: { kind: 'screen', id: 'cognition' },
    });
    expect(next(battery)).toMatchObject({
      zone: { id: 'mind' },
      target: { kind: 'screen', id: 'wellbeing' },
    });
    const bp = next([...battery, ...checkin]);
    expect(bp?.target).toEqual({ kind: 'indicator', id: 'systolic-bp' });
    expect(bp?.label).toEqual(config.zones.find((z) => z.id === 'vitals')?.dailyAction.text);
  });

  it('names other measurements by their indicator', () => {
    const done = [...battery, ...checkin, reading('systolic-bp', 118), reading('glucose', 90)];
    const temperature = next(done);
    expect(temperature?.target).toEqual({ kind: 'indicator', id: 'body-temperature' });
    expect(temperature?.label).toEqual(
      config.indicators.find((i) => i.id === 'body-temperature')?.name,
    );
  });
});

describe('latestTakenAt', () => {
  it('returns the newest timestamp or undefined', () => {
    expect(latestTakenAt([])).toBeUndefined();
    expect(
      latestTakenAt([
        { takenAt: '2026-11-01T10:00:00.000Z' },
        { takenAt: '2026-11-02T10:00:00.000Z' },
      ]),
    ).toBe('2026-11-02T10:00:00.000Z');
  });
});
