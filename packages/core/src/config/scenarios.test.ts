import { describe, expect, it } from 'vitest';
import type { Reading, Scenario } from '../contracts';
import { computeBaselines, evaluate, evaluateZones } from '../engine';
import { actions, loadConfig, SYMPTOM_INDICATOR } from './index';
import { scenarios } from './testdata';

// Plays each scenario as plain readings (series, categorical extras and monitor events, the way the
// phone stores them) and checks the engine reaches the expected level per zone at the end of the script.

type WithCategorical = Scenario & {
  categorical?: { indicator: string; points: [number, string][] }[];
};

const START = new Date('2026-11-14T08:00:00.000Z');
const ENVIRONMENT = 'transit';
const config = loadConfig();

function at(minute: number): string {
  return new Date(START.getTime() + minute * 60_000).toISOString();
}

function readingsFor(s: WithCategorical): Reading[] {
  const out: Reading[] = [];
  const add = (indicator: string, value: number | string, minute: number) =>
    out.push({
      id: `${s.id}-${indicator}-${out.length}`,
      indicator,
      value,
      unit: config.indicators.find((i) => i.id === indicator)?.unit ?? '',
      takenAt: at(minute),
      source: indicator === SYMPTOM_INDICATOR ? 'screen' : 'simulator',
      simulated: true,
      crewMember: 'elena-vega',
    });
  for (const serie of s.series) for (const [m, v] of serie.points) add(serie.indicator, v, m);
  for (const c of s.categorical ?? []) for (const [m, v] of c.points) add(c.indicator, v, m);
  for (const e of s.events) {
    if (e.message !== 'monitor') continue;
    const p = e.payload as { heartRate: number; spo2?: number };
    add('heart-rate', p.heartRate, e.minute);
    if (p.spo2 !== undefined) add('spo2', p.spo2, e.minute);
  }
  return out.sort((a, b) => a.takenAt.localeCompare(b.takenAt));
}

describe('acceptance criteria that depend on the thresholds', () => {
  const now = new Date(at(60));
  const r = (indicator: string, value: number | string, minute: number): Reading => ({
    id: `${indicator}-${minute}-${value}`,
    indicator,
    value,
    unit: '',
    takenAt: at(minute),
    source: indicator === SYMPTOM_INDICATOR ? 'screen' : 'manual',
    simulated: false,
    crewMember: 'elena-vega',
  });
  const levelOf = (readings: Reading[], id: string, env = ENVIRONMENT) => {
    const baselines = computeBaselines(readings, [id]);
    return evaluate(readings, config, env, baselines, [], now, { actions }).find(
      (a) => a.indicator === id,
    )?.level;
  };

  it('blood pressure 150/95 is amber', () => {
    expect(levelOf([r('systolic-bp', 150, 50)], 'systolic-bp')).toBe('amber');
    expect(levelOf([r('diastolic-bp', 95, 50)], 'diastolic-bp')).toBe('amber');
  });

  it('heart rate 130 with symptoms is red, without symptoms amber', () => {
    expect(
      levelOf([r('heart-rate', 130, 50), r(SYMPTOM_INDICATOR, 'chest-pain', 49)], 'heart-rate'),
    ).toBe('red');
    expect(levelOf([r('heart-rate', 130, 50)], 'heart-rate')).toBe('amber');
  });

  it('three stress check-ins at 4 turn amber, two do not', () => {
    const two = [r('stress', 2, 10), r('stress', 4, 20), r('stress', 4, 30)];
    expect(levelOf(two, 'stress')).toBe('green');
    expect(levelOf([...two, r('stress', 4, 40)], 'stress')).toBe('amber');
  });

  it('a reaction 20% slower than a steady baseline is amber', () => {
    const base = [280, 290, 285, 275, 295, 282, 288, 279, 291, 286].map((v, i) =>
      r('reaction-time', v, i),
    );
    expect(levelOf(base, 'reaction-time')).toBe('green');
    expect(levelOf([...base, r('reaction-time', 342, 30)], 'reaction-time')).toBe('amber');
  });

  it('spo2 94 is amber in transit and green on Mars', () => {
    expect(levelOf([r('spo2', 94, 50)], 'spo2', 'transit')).toBe('amber');
    expect(levelOf([r('spo2', 94, 50)], 'spo2', 'mars')).toBe('green');
  });
});

describe('scenarios played through the engine', () => {
  for (const s of scenarios as WithCategorical[]) {
    it(`${s.id} reaches the expected zone levels`, () => {
      const readings = readingsFor(s);
      const now = new Date(at(s.durationMin));
      const baselines = computeBaselines(
        readings,
        config.indicators.map((i) => i.id),
      );
      const assessments = evaluate(readings, config, ENVIRONMENT, baselines, [], now, { actions });
      const zones = evaluateZones(assessments, config);
      for (const e of s.expected) {
        const zone = zones.find((z) => z.zone === e.zone);
        const detail = zone?.assessments.map((a) => `${a.indicator}=${a.level}`).join(', ');
        expect(zone?.level, `${s.id} · ${e.zone}: ${detail}`).toBe(e.level);
      }
    });
  }
});
