import { describe, expect, it } from 'vitest';
import { isTracked, loadConfig } from '../config';
import {
  computeBaseline,
  computeBaselines,
  dayHistory,
  evaluate,
  evaluateZones,
  streak,
} from '../engine';
import { DEMO_CREW, DEMO_MISSION } from './demo';
import { demoHistory, demoMissedDays, SERIES } from './series';

const config = loadConfig();
const now = new Date('2026-11-14T12:00:00.000Z');
const values = (rs: { indicator: string; value: number | string }[], id: string) =>
  rs.filter((r) => r.indicator === id).map((r) => Number(r.value));

describe('demoHistory', () => {
  it('has a series for every config indicator', () => {
    const ids = new Set(SERIES.map((s) => s.indicator));
    expect(config.indicators.map((i) => i.id).filter((id) => !ids.has(id))).toEqual([]);
  });

  it('is deterministic, looks like real records and ends at now', () => {
    const a = demoHistory('mateo-rios', now, { config });
    const b = demoHistory('mateo-rios', now, { config });
    expect(a).toEqual(b);
    expect(a.every((r) => !r.simulated && r.crewMember === 'mateo-rios')).toBe(true);
    expect(a.every((r) => r.takenAt <= now.toISOString())).toBe(true);
    expect(
      a.every((r) => r.takenAt > new Date(now.getTime() - 30 * 86_400_000).toISOString()),
    ).toBe(true);
    expect(
      a.filter((r) => r.indicator === 'cabin-pressure').every((r) => r.source === 'phone'),
    ).toBe(true);
    expect(a.filter((r) => r.indicator === 'sleep').every((r) => r.source === 'watch')).toBe(true);
    expect(demoHistory('elena-vega', now, { config })).not.toEqual(a);
  });

  it('uses the realistic source of each indicator', () => {
    const a = demoHistory('elena-vega', now, { config });
    const sourceOf = (id: string) =>
      new Set(a.filter((r) => r.indicator === id).map((r) => r.source));
    const expected: Record<string, string> = {
      'heart-rate': 'watch',
      sleep: 'watch',
      spo2: 'watch',
      steps: 'healthkit',
      'systolic-bp': 'manual',
      'diastolic-bp': 'manual',
      glucose: 'manual',
      'body-temperature': 'manual',
      'food-intake': 'manual',
      'resistance-exercise': 'manual',
      'reaction-time': 'screen',
      'pvt-lapses': 'screen',
      'working-memory': 'screen',
      'go-nogo-accuracy': 'screen',
      mood: 'screen',
      stress: 'screen',
      'radiation-dose': 'manual',
      'cabin-pressure': 'phone',
      hydration: 'manual',
      'daily-action': 'screen',
    };
    for (const [id, source] of Object.entries(expected)) {
      expect([...sourceOf(id)], id).toEqual([source]);
    }
    expect(a.some((r) => (r.source as string) === 'simulator')).toBe(false);
    expect(a.some((r) => !isTracked(r.indicator))).toBe(false);
  });

  it('series are coherent over 30 days', () => {
    const rs = demoHistory('elena-vega', now, { config });
    const sleep = values(rs, 'sleep');
    expect(sleep.length).toBeGreaterThanOrEqual(29);
    expect(Math.max(...sleep) - Math.min(...sleep)).toBeLessThanOrEqual(0.61);
    const hr = computeBaseline(rs, 'heart-rate');
    expect((hr?.range[1] ?? 0) - (hr?.range[0] ?? 0)).toBeLessThan(20);
    expect(new Set(values(rs, 'mood'))).toEqual(new Set([4, 5]));
  });

  it('Mateo drifts slowly in reaction time; the others do not', () => {
    const drift = (id: string) => {
      const v = values(demoHistory(id, now, { config }), 'reaction-time');
      const avg = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / xs.length;
      return avg(v.slice(-7)) - avg(v.slice(0, 7));
    };
    expect(drift('mateo-rios')).toBeGreaterThan(8);
    expect(Math.abs(drift('elena-vega'))).toBeLessThan(10);
  });

  it('nominal history evaluates with every zone green for the whole crew', () => {
    for (const { id } of DEMO_CREW) {
      const rs = demoHistory(id, now, { config });
      const baseline = computeBaselines(
        rs,
        config.indicators.map((i) => i.id),
      );
      const zones = evaluateZones(
        evaluate(rs, config, DEMO_MISSION.environment, baseline, [], now),
        config,
      );
      const notGreen = zones
        .flatMap((z) => z.assessments)
        .filter((a) => a.level !== 'green')
        .map((a) => `${id}/${a.indicator}=${a.level}(${a.value})`);
      expect(notGreen).toEqual([]);
    }
  });
});

describe('demoHistory routine streak', () => {
  it('most past days are complete: the demo starts with a 5–12 day streak', () => {
    for (const { id } of DEMO_CREW) {
      const rs = demoHistory(id, now, { config });
      const days = dayHistory(rs, config, now, 30);
      const today = now.toISOString().slice(0, 10);
      const s = streak(days, today);
      expect(s).toBeGreaterThan(0);
      expect(s).toBeGreaterThanOrEqual(5);
      expect(s).toBeLessThanOrEqual(12);
      expect(s).toBe(Math.min(...demoMissedDays(id)) - 1);
      const past = days.slice(1, -1);
      expect(past.filter((d) => !d.complete).length).toBeGreaterThanOrEqual(2);
      expect(past.filter((d) => d.complete).length).toBeGreaterThanOrEqual(22);
      expect(days.at(-1)?.complete).toBe(false);
    }
  });
});
