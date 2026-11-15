import type { Reading } from '@haven/core';
import { describe, expect, it } from 'vitest';
import {
  dailyTotalReading,
  latestByIndicator,
  localDay,
  planIndicator,
  resistanceMinutes,
  rhythmFromEcg,
  type SourceStatus,
  sleepNights,
  wristTemperatureDeviations,
} from './sources';

function status(partial: Partial<SourceStatus> & Pick<SourceStatus, 'id' | 'state'>): SourceStatus {
  return { indicators: [], primary: [], withData: [], ...partial };
}

const healthkit = (state: SourceStatus['state'], withData: string[] = []) =>
  status({
    id: 'healthkit',
    state,
    indicators: ['steps', 'distance', 'floors', 'heart-rate'],
    primary: ['steps', 'distance', 'floors'],
    withData,
  });

describe('planIndicator', () => {
  it('HealthKit with data feeds steps; heart rate without data falls back to manual', () => {
    const statuses = [healthkit('connected', ['steps'])];
    expect(planIndicator('steps', statuses)).toEqual({
      indicator: 'steps',
      source: 'healthkit',
      mode: 'provider',
    });
    expect(planIndicator('heart-rate', statuses).mode).toBe('manual');
  });

  it('a refused permission leaves primary indicators pending', () => {
    const plan = planIndicator('steps', [healthkit('denied')]);
    expect(plan).toMatchObject({ mode: 'pending', deniedBy: 'healthkit' });
  });

  it('a refused HealthKit does not block indicators it is not primary for', () => {
    expect(planIndicator('heart-rate', [healthkit('denied')]).mode).toBe('manual');
  });

  it('a connected fallback (pedometer) beats a refused HealthKit', () => {
    const pedometer = status({
      id: 'pedometer',
      state: 'connected',
      indicators: ['steps'],
      primary: ['steps'],
      withData: ['steps'],
    });
    expect(planIndicator('steps', [healthkit('denied'), pedometer])).toMatchObject({
      source: 'pedometer',
      mode: 'provider',
    });
  });

  it('without provider data, only manual entry is left', () => {
    expect(planIndicator('glucose', [healthkit('unavailable')]).mode).toBe('manual');
  });
});

describe('daily totals', () => {
  it('id changes only with the total, value rounded', () => {
    const base = {
      provider: 'healthkit' as const,
      source: 'healthkit' as const,
      indicator: 'distance',
      unit: 'km',
      decimals: 2,
      day: new Date(2026, 10, 1, 9),
      takenAt: new Date(2026, 10, 1, 9),
      crewMember: 'elena-vega',
    };
    const a = dailyTotalReading({ ...base, total: 3.14259 });
    const b = dailyTotalReading({ ...base, total: 3.1401, takenAt: new Date(2026, 10, 1, 10) });
    expect(a.value).toBe(3.14);
    expect(a.id).toBe('healthkit:distance:2026-11-01:3.14');
    expect(b.id).toBe(a.id);
    expect(a.simulated).toBe(false);
    expect(localDay(new Date(2026, 0, 5))).toBe('2026-01-05');
  });

  it('latestByIndicator keeps the last reading of each indicator', () => {
    const rs = [
      { indicator: 'a', id: '1' },
      { indicator: 'b', id: '2' },
      { indicator: 'a', id: '3' },
    ] as Reading[];
    const latest = latestByIndicator(rs);
    expect(latest.get('a')?.id).toBe('3');
    expect(latest.get('b')?.id).toBe('2');
  });
});

describe('sleepNights', () => {
  it('sums asleep segments per morning and ignores in-bed and awake', () => {
    const h = (d: number, hour: number) => new Date(2026, 10, d, hour);
    const nights = sleepNights([
      { start: h(1, 23), end: h(2, 3), value: 3 },
      { start: h(2, 3), end: h(2, 4), value: 2 },
      { start: h(2, 4), end: h(2, 6), value: 4 },
      { start: h(1, 22), end: h(2, 7), value: 0 },
    ]);
    expect(nights).toEqual([{ day: '2026-11-02', hours: 6, end: h(2, 6) }]);
  });
});

describe('wristTemperatureDeviations', () => {
  const night = (n: number, value: number) => ({
    id: `n${n}`,
    value,
    end: new Date(2026, 10, n, 7, 0),
  });

  it('needs five earlier nights before it reports a deviation', () => {
    const nights = [1, 2, 3, 4, 5].map((n) => night(n, 35));
    expect(wristTemperatureDeviations(nights)).toEqual([]);
    const out = wristTemperatureDeviations([...nights, night(6, 36.24)]);
    expect(out).toEqual([{ id: 'n6', deviation: 1.2, end: night(6, 0).end }]);
  });

  it('compares each night with the nights before it, whatever the input order', () => {
    const nights = [night(7, 34.5), ...[1, 2, 3, 4, 5, 6].map((n) => night(n, 35))];
    expect(wristTemperatureDeviations(nights).map((d) => [d.id, d.deviation])).toEqual([
      ['n6', 0],
      ['n7', -0.5],
    ]);
  });
});

describe('rhythmFromEcg', () => {
  it('maps only conclusive ECG classifications', () => {
    expect(rhythmFromEcg('sinusRhythm')).toBe('sinus');
    expect(rhythmFromEcg('atrialFibrillation')).toBe('irregular');
    expect(rhythmFromEcg('inconclusivePoorReading')).toBeUndefined();
    expect(rhythmFromEcg('notSet')).toBeUndefined();
  });
});

describe('resistanceMinutes', () => {
  it('adds the strength workouts of each local day and ignores the rest', () => {
    const at = (day: number, hour: number) => new Date(2026, 10, day, hour, 0);
    const out = resistanceMinutes([
      { type: 50, end: at(3, 9), seconds: 1500 },
      { type: 20, end: at(3, 18), seconds: 1230 },
      { type: 37, end: at(3, 20), seconds: 3600 },
      { type: 59, end: at(4, 8), seconds: 600 },
      { type: 50, end: at(4, 9), seconds: 0 },
    ]);
    expect(out).toEqual([
      { day: at(3, 0), minutes: 46, end: at(3, 18) },
      { day: at(4, 0), minutes: 10, end: at(4, 8) },
    ]);
  });
});
