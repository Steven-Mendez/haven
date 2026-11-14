import type { Reading } from '@haven/core';
import { describe, expect, it } from 'vitest';
import {
  dailyTotalReading,
  latestByIndicator,
  localDay,
  planIndicator,
  type SourceStatus,
  sleepNights,
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
