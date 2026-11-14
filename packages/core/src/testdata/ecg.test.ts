import { describe, expect, it } from 'vitest';
import type { Reading, Scenario } from '../contracts';
import { ecgFromReadings, simulatedEcg } from './ecg';
import { createSimulator, type Timers } from './provider';

function rPeaks({ hz, microvolts }: { hz: number; microvolts: number[] }): number[] {
  const peaks: number[] = [];
  microvolts.forEach((v, i) => {
    const prev = microvolts[i - 1] ?? 0;
    const next = microvolts[i + 1] ?? 0;
    if (v > 600 && v >= prev && v > next) peaks.push(i / hz);
  });
  return peaks;
}
const intervals = (p: number[]) => p.slice(1).map((t, i) => t - (p[i] as number));
const cv = (xs: number[]) => {
  const m = xs.reduce((a, b) => a + b, 0) / xs.length;
  return Math.sqrt(xs.reduce((a, b) => a + (b - m) ** 2, 0) / xs.length) / m;
};

describe('simulatedEcg', () => {
  it('defaults: 10 s at 250 Hz, deterministic, plausible amplitudes', () => {
    const a = simulatedEcg();
    expect(a.hz).toBe(250);
    expect(a.microvolts).toHaveLength(2500);
    expect(simulatedEcg()).toEqual(a);
    expect(simulatedEcg({ seed: 2 })).not.toEqual(a);
    expect(Math.max(...a.microvolts)).toBeGreaterThan(900);
    expect(Math.max(...a.microvolts)).toBeLessThan(1500);
    expect(Math.min(...a.microvolts)).toBeLessThan(-150);
    expect(a.microvolts.every(Number.isInteger)).toBe(true);
  });

  it('beats match the heart rate; sinus is regular', () => {
    const peaks = rPeaks(simulatedEcg({ heartRate: 60, seconds: 20 }));
    expect(peaks.length).toBeGreaterThanOrEqual(18);
    expect(peaks.length).toBeLessThanOrEqual(21);
    expect(cv(intervals(peaks))).toBeLessThan(0.06);
    expect(rPeaks(simulatedEcg({ heartRate: 150, seconds: 20 })).length).toBeGreaterThan(45);
  });

  it('irregular rhythm has irregular RR intervals', () => {
    const peaks = rPeaks(simulatedEcg({ rhythm: 'irregular', heartRate: 110, seconds: 20 }));
    expect(cv(intervals(peaks))).toBeGreaterThan(0.12);
  });

  it('ecgFromReadings follows the latest rhythm and heart rate', () => {
    const r = (indicator: string, value: number | string, takenAt: string): Reading => ({
      id: `${indicator}-${takenAt}`,
      indicator,
      value,
      unit: '',
      takenAt,
      source: 'simulator',
      simulated: true,
      crewMember: 'x',
    });
    const rs = [
      r('heart-rhythm', 'sinus', '2026-11-14T08:00:00.000Z'),
      r('heart-rhythm', 'irregular', '2026-11-14T08:05:00.000Z'),
      r('heart-rate', 140, '2026-11-14T08:05:00.000Z'),
    ];
    const ecg = ecgFromReadings(rs, { seed: 3, seconds: 20 });
    expect(ecg).toEqual(
      simulatedEcg({ rhythm: 'irregular', heartRate: 140, seed: 3, seconds: 20 }),
    );
    const before = ecgFromReadings(rs, { seed: 3, now: new Date('2026-11-14T08:01:00.000Z') });
    expect(before).toEqual(simulatedEcg({ rhythm: 'sinus', seed: 3 }));
  });
});

describe('SimulatorProvider.latestSimulatedEcg', () => {
  it('uses the active scenario rhythm and heart rate', () => {
    const queue: (() => void)[] = [];
    const timers: Timers = {
      setTimeout: (fn) => queue.push(fn),
      clearTimeout: () => {},
    };
    const t = { es: '', en: '' };
    const scenario = {
      id: 'af',
      name: t,
      durationMin: 2,
      sources: [],
      series: [
        {
          indicator: 'heart-rate',
          points: [
            [0, 80],
            [2, 150],
          ],
        },
      ],
      categorical: [
        {
          indicator: 'heart-rhythm',
          points: [
            [0, 'sinus'],
            [1, 'irregular'],
          ],
        },
      ],
      events: [],
      expected: [],
    } as unknown as Scenario;
    const sim = createSimulator({
      crewMember: 'mateo-rios',
      start: new Date('2026-11-14T08:00:00.000Z'),
      scenarios: [scenario],
      timers,
      clock: () => 0,
      history: false,
    });
    expect(sim.latestSimulatedEcg({ seconds: 2 }).microvolts).toHaveLength(500);
    sim.play('af');
    while (queue.length > 0) queue.shift()?.();
    const peaks = rPeaks(sim.latestSimulatedEcg({ seconds: 20 }));
    expect(peaks.length).toBeGreaterThan(40);
    expect(cv(intervals(peaks))).toBeGreaterThan(0.12);
    expect(sim.latestSimulatedEcg()).toEqual(sim.latestSimulatedEcg());
  });
});
