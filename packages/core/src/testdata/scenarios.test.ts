import { describe, expect, it } from 'vitest';
import { loadConfig } from '../config';
import { scenarios } from '../config/testdata';
import { computeBaselines, configForEnvironment, evaluate, evaluateZones } from '../engine';
import { DEMO_MISSION } from './demo';
import { scenarioReadings } from './scenario';
import { demoHistory } from './series';

const config = loadConfig();
const crewMember = 'elena-vega';
const start = new Date('2026-11-14T08:00:00.000Z');

describe('scenarios (Content config, played in full and evaluated)', () => {
  it('Content publishes the five scenarios', () => {
    expect(scenarios.map((s) => s.id).sort()).toEqual(
      ['cabin-atmosphere', 'nominal', 'sleep-mood', 'solar-storm', 'video'].sort(),
    );
  });

  for (const scenario of scenarios) {
    it(`${scenario.id} meets its expected zone levels`, () => {
      const history = demoHistory(crewMember, start, { config });
      const played = scenarioReadings(scenario, crewMember, start, { config });
      const readings = [...history, ...played];
      const now = new Date(start.getTime() + scenario.durationMin * 60_000);
      const env = configForEnvironment(config, DEMO_MISSION.environment);
      const baseline = computeBaselines(
        readings.filter((r) => r.takenAt <= now.toISOString()),
        env.indicators.map((i) => i.id),
      );
      const assessments = evaluate(readings, config, DEMO_MISSION.environment, baseline, [], now);
      const zones = evaluateZones(assessments, config);
      const got = scenario.expected.map((e) => ({
        zone: e.zone,
        level: zones.find((z) => z.zone === e.zone)?.level,
      }));
      const detail = zones
        .filter((z) => scenario.expected.some((e) => e.zone === z.zone))
        .flatMap((z) =>
          z.assessments
            .filter((a) => a.level !== 'green')
            .map((a) => `${z.zone}/${a.indicator}=${a.level}(${a.value})`),
        );
      expect({ got, detail }).toMatchObject({ got: scenario.expected });
    });
  }
});

describe('engine acceptance with the Content config', () => {
  const now = new Date('2026-11-14T12:00:00.000Z');
  const base = demoHistory(crewMember, new Date(now.getTime() - 3 * 86_400_000), { config });
  const checkIn = (stress: number, daysAgo: number) => ({
    id: `stress-${daysAgo}`,
    indicator: 'stress',
    value: stress,
    unit: '1-5',
    takenAt: new Date(now.getTime() - daysAgo * 86_400_000 - 60_000).toISOString(),
    source: 'screen' as const,
    simulated: false,
    crewMember,
  });
  const mind = (extra: ReturnType<typeof checkIn>[]) => {
    const readings = [...base, ...extra];
    const baseline = computeBaselines(
      readings,
      config.indicators.map((i) => i.id),
    );
    const zones = evaluateZones(evaluate(readings, config, 'transit', baseline, [], now), config);
    return zones.find((z) => z.zone === 'mind');
  };

  it('two stress check-ins of 4 do not turn Mind amber; three do', () => {
    const stressOf = (z: ReturnType<typeof mind>) =>
      z?.assessments.find((a) => a.indicator === 'stress')?.level;
    expect(stressOf(mind([checkIn(4, 1), checkIn(4, 0)]))).toBe('green');
    expect(stressOf(mind([checkIn(4, 2), checkIn(4, 1), checkIn(4, 0)]))).toBe('amber');
    expect(mind([checkIn(4, 2), checkIn(4, 1), checkIn(4, 0)])?.level).toBe('amber');
  });
});

describe('baseline without acute episodes', () => {
  it("Mateo's heart-rate band ignores the video emergency", () => {
    const video = scenarios.find((s) => s.id === 'video');
    if (!video) throw new Error('video scenario missing');
    const readings = [
      ...demoHistory('mateo-rios', start, { config }),
      ...scenarioReadings(video, 'mateo-rios', start, { config }),
    ];
    const b = computeBaselines(readings, ['heart-rate'])['heart-rate'];
    expect(b?.range[0]).toBeGreaterThan(55);
    expect(b?.range[1]).toBeLessThan(85);
  });
});
