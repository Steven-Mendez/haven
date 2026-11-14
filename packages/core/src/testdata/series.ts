import { isTracked } from '../config';
import type { Config, Indicator, Reading, ReadingSource } from '../contracts';
import { contentConfig } from './config-source';
import { DEMO_MISSION } from './demo';
import { gaussian, hashSeed, mulberry32 } from './prng';

const HOUR_MS = 3_600_000;
const DAY_MS = 86_400_000;

export type CrewProfile = {
  heartRate: number;
  systolic: number;
  diastolic: number;
  hrv: number;
  sleep: number;
  weight: number;
  reaction: number;
  reactionDriftPerDay: number;
  glucose: number;
};

export const CREW_PROFILES: Record<string, CrewProfile> = {
  'elena-vega': {
    heartRate: 66,
    systolic: 114,
    diastolic: 72,
    hrv: 55,
    sleep: 7.0,
    weight: 61,
    reaction: 272,
    reactionDriftPerDay: 0,
    glucose: 86,
  },
  'mateo-rios': {
    heartRate: 70,
    systolic: 118,
    diastolic: 75,
    hrv: 47,
    sleep: 6.8,
    weight: 78,
    reaction: 285,
    reactionDriftPerDay: 0.8,
    glucose: 90,
  },
  'samira-chen': {
    heartRate: 64,
    systolic: 108,
    diastolic: 70,
    hrv: 62,
    sleep: 7.2,
    weight: 57,
    reaction: 265,
    reactionDriftPerDay: 0,
    glucose: 84,
  },
};

function profileOf(crewMember: string): CrewProfile {
  const known = CREW_PROFILES[crewMember];
  if (known) return known;
  const rng = mulberry32(hashSeed(crewMember));
  const base = CREW_PROFILES['elena-vega'] as CrewProfile;
  return { ...base, heartRate: base.heartRate + Math.round(rng() * 6 - 3) };
}

type Ctx = {
  t: number;
  missionDay: number;
  hour: number;
  rng: () => number;
  p: CrewProfile;
};

export type SeriesDef = {
  indicator: string;
  unit: string;
  everyHours: number;
  source: ReadingSource;
  decimals: number;
  value: (c: Ctx) => number | string;
  note?: (c: Ctx) => string | undefined;
};

const inRestModule = (hour: number) => hour >= 22 || hour < 6;
const circadian = (hour: number) => Math.sin(((hour - 10) / 24) * 2 * Math.PI);

export const SERIES: SeriesDef[] = [
  {
    indicator: 'heart-rate',
    unit: 'bpm',
    everyHours: 1,
    source: 'watch',
    decimals: 0,
    value: (c) => c.p.heartRate + 4 * circadian(c.hour) + gaussian(c.rng, 2),
  },
  {
    indicator: 'hrv',
    unit: 'ms',
    everyHours: 24,
    source: 'watch',
    decimals: 0,
    value: (c) => c.p.hrv + gaussian(c.rng, 3),
  },
  {
    indicator: 'heart-rhythm',
    unit: '',
    everyHours: 24,
    source: 'watch',
    decimals: 0,
    value: () => 'sinus',
  },
  {
    indicator: 'systolic-bp',
    unit: 'mmHg',
    everyHours: 24,
    source: 'manual',
    decimals: 0,
    value: (c) => c.p.systolic + gaussian(c.rng, 3),
  },
  {
    indicator: 'diastolic-bp',
    unit: 'mmHg',
    everyHours: 24,
    source: 'manual',
    decimals: 0,
    value: (c) => c.p.diastolic + gaussian(c.rng, 2),
  },
  {
    indicator: 'spo2',
    unit: '%',
    everyHours: 12,
    source: 'watch',
    decimals: 0,
    value: (c) => Math.min(99, 97.5 + gaussian(c.rng, 0.7)),
  },
  {
    indicator: 'cabin-co2',
    unit: 'mmHg',
    everyHours: 1,
    source: 'ship',
    decimals: 2,
    value: (c) => (inRestModule(c.hour) ? 2.3 : 1.8) + gaussian(c.rng, 0.12),
    note: (c) => (inRestModule(c.hour) ? 'module:rest' : 'module:lab'),
  },
  {
    indicator: 'cabin-noise',
    unit: 'dB',
    everyHours: 1,
    source: 'ship',
    decimals: 0,
    value: (c) => (inRestModule(c.hour) ? 52 : 48) + gaussian(c.rng, 1.5),
    note: (c) => (inRestModule(c.hour) ? 'module:rest' : 'module:lab'),
  },
  {
    indicator: 'visual-acuity',
    unit: 'tenths',
    everyHours: 168,
    source: 'screen',
    decimals: 0,
    value: (c) => (c.rng() < 0.15 ? 9 : 10),
  },
  {
    indicator: 'reaction-time',
    unit: 'ms',
    everyHours: 24,
    source: 'screen',
    decimals: 0,
    value: (c) =>
      c.p.reaction +
      c.p.reactionDriftPerDay * (c.missionDay - (DEMO_MISSION.day - 30)) +
      gaussian(c.rng, 6),
  },
  {
    indicator: 'pvt-lapses',
    unit: 'count',
    everyHours: 24,
    source: 'screen',
    decimals: 0,
    value: (c) => (c.rng() < 0.12 ? 1 : 0),
  },
  {
    indicator: 'working-memory',
    unit: 'level',
    everyHours: 24,
    source: 'screen',
    decimals: 0,
    value: (c) => (c.rng() < 0.2 ? 4 : 5),
  },
  {
    indicator: 'go-nogo-accuracy',
    unit: '%',
    everyHours: 24,
    source: 'screen',
    decimals: 0,
    value: (c) => Math.min(100, 96 + gaussian(c.rng, 1.5)),
  },
  {
    indicator: 'glucose',
    unit: 'mg/dL',
    everyHours: 24,
    source: 'manual',
    decimals: 0,
    value: (c) => c.p.glucose + gaussian(c.rng, 4),
  },
  {
    indicator: 'body-temperature',
    unit: '°C',
    everyHours: 24,
    source: 'manual',
    decimals: 1,
    value: (c) => 36.7 + gaussian(c.rng, 0.15),
  },
  {
    indicator: 'wrist-temperature',
    unit: '°C',
    everyHours: 24,
    source: 'watch',
    decimals: 2,
    value: (c) => gaussian(c.rng, 0.12),
  },
  {
    indicator: 'weight',
    unit: 'kg',
    everyHours: 168,
    source: 'manual',
    decimals: 1,
    value: (c) => c.p.weight * (1 - 0.00004 * c.missionDay) + gaussian(c.rng, 0.15),
  },
  {
    indicator: 'food-intake',
    unit: 'kcal',
    everyHours: 24,
    source: 'manual',
    decimals: 0,
    value: (c) => c.p.weight * 38 + gaussian(c.rng, 120),
  },
  {
    indicator: 'hydration',
    unit: 'mL',
    everyHours: 24,
    source: 'manual',
    decimals: 0,
    value: (c) => Math.round((2600 + gaussian(c.rng, 180)) / 50) * 50,
  },
  {
    indicator: 'resistance-exercise',
    unit: 'min',
    everyHours: 24,
    source: 'manual',
    decimals: 0,
    value: (c) => 45 + Math.floor(c.rng() * 16),
  },
  {
    indicator: 'bone-loss',
    unit: '%',
    everyHours: 168,
    source: 'manual',
    decimals: 2,
    value: (c) => 0.012 * c.missionDay + gaussian(c.rng, 0.02),
  },
  {
    indicator: 'steps',
    unit: 'steps',
    everyHours: 24,
    source: 'healthkit',
    decimals: 0,
    value: (c) => 4200 + gaussian(c.rng, 500),
  },
  {
    indicator: 'distance',
    unit: 'km',
    everyHours: 24,
    source: 'healthkit',
    decimals: 2,
    value: (c) => 3.0 + gaussian(c.rng, 0.35),
  },
  {
    indicator: 'floors',
    unit: 'floors',
    everyHours: 24,
    source: 'healthkit',
    decimals: 0,
    value: (c) => Math.floor(c.rng() * 3),
  },
  {
    indicator: 'radiation-dose',
    unit: 'mSv/day',
    everyHours: 24,
    source: 'manual',
    decimals: 2,
    value: (c) => 1.6 + gaussian(c.rng, 0.08),
  },
  {
    indicator: 'cabin-pressure',
    unit: 'kPa',
    everyHours: 1,
    source: 'phone',
    decimals: 1,
    value: (c) => 101.3 + gaussian(c.rng, 0.25),
  },
  {
    indicator: 'solar-event',
    unit: 'S',
    everyHours: 1,
    source: 'ship',
    decimals: 0,
    value: () => 0,
  },
  {
    indicator: 'mood',
    unit: '1-5',
    everyHours: 24,
    source: 'screen',
    decimals: 0,
    value: (c) => (c.rng() < 0.1 ? 5 : 4),
  },
  {
    indicator: 'stress',
    unit: '1-5',
    everyHours: 24,
    source: 'screen',
    decimals: 0,
    value: (c) => (c.rng() < 0.1 ? 1 : 2),
  },
  {
    indicator: 'sleep',
    unit: 'h',
    everyHours: 24,
    source: 'watch',
    decimals: 1,
    value: (c) => c.p.sleep + (c.rng() * 0.6 - 0.3),
  },
];

export const SOURCE_BY_INDICATOR: Record<string, ReadingSource> = Object.fromEntries(
  SERIES.map((s) => [s.indicator, s.source]),
);

export const SERIES_BY_INDICATOR: Record<string, SeriesDef> = Object.fromEntries(
  SERIES.map((s) => [s.indicator, s]),
);

function clampToGreen(v: number, ind: Indicator | undefined): number {
  if (ind?.kind !== 'number') return v;
  const [lo, hi] = ind.green;
  if (!(hi > lo)) return v;
  const m = (hi - lo) * 0.05;
  return Math.min(hi - m, Math.max(lo + m, v));
}

function roundTo(v: number, decimals: number): number {
  const f = 10 ** decimals;
  return Math.round(v * f) / f;
}

export type GenerateOptions = {
  config?: Config;
  missionDay?: number;
  anchor?: number;
};

export function cadenceHours(def: SeriesDef, config?: Config): number {
  const ind = config?.indicators.find((i) => i.id === def.indicator);
  return Math.max(0.25, ind?.everyHours ?? def.everyHours);
}

export function generateSeries(
  crewMember: string,
  indicator: string,
  from: number,
  to: number,
  options?: GenerateOptions,
): Reading[] {
  const def = SERIES_BY_INDICATOR[indicator];
  if (!def || !isTracked(indicator)) return [];
  const config = options?.config;
  const ind = config?.indicators.find((i) => i.id === indicator);
  const p = profileOf(crewMember);
  const stepMs = cadenceHours(def, config) * HOUR_MS;
  const anchor = options?.anchor ?? to;
  const missionDay0 = options?.missionDay ?? DEMO_MISSION.day;
  const offsetMs = Math.floor(mulberry32(hashSeed(`${crewMember}:${indicator}`))() * 0.05 * stepMs);
  const result: Reading[] = [];
  for (let t = to - offsetMs; t > from; t -= stepMs) {
    const rng = mulberry32(hashSeed(`${crewMember}:${indicator}:${Math.floor(t / 60_000)}`));
    const ctx: Ctx = {
      t,
      missionDay: missionDay0 + (t - anchor) / DAY_MS,
      hour: new Date(t).getUTCHours(),
      rng,
      p,
    };
    const raw = def.value(ctx);
    const value = typeof raw === 'number' ? roundTo(clampToGreen(raw, ind), def.decimals) : raw;
    const note = def.note?.(ctx);
    result.push({
      id: `sim-${crewMember}-${indicator}-${t}`,
      indicator,
      value,
      unit: ind?.unit ?? def.unit,
      takenAt: new Date(t).toISOString(),
      source: def.source,
      simulated: false,
      crewMember,
      ...(note ? { note } : {}),
    });
  }
  return result.reverse();
}

export type DemoHistoryOptions = GenerateOptions & {
  days?: number;
  indicators?: string[];
  dailyActions?: boolean;
};

const DEFAULT_ROUTINE_ZONES = ['environment'];

export function demoMissedDays(crewMember: string): number[] {
  const seed = hashSeed(`${crewMember}:missed`);
  return [6 + (seed % 6), 17 + ((seed >>> 8) % 5)];
}

function dailyActionMarks(
  crewMember: string,
  from: number,
  to: number,
  config: Config | undefined,
): Reading[] {
  const zones = config
    ? config.zones.filter((z) => z.dailyAction.opens === 'routine').map((z) => z.id)
    : DEFAULT_ROUTINE_ZONES;
  const missed = new Set(demoMissedDays(crewMember));
  const today = new Date(to).toISOString().slice(0, 10);
  const result: Reading[] = [];
  for (let k = 1; k * DAY_MS < to - from + DAY_MS; k++) {
    if (missed.has(k)) continue;
    const date = new Date(new Date(`${today}T00:00:00.000Z`).getTime() - k * DAY_MS);
    for (const zone of zones) {
      const minute = Math.floor(mulberry32(hashSeed(`${crewMember}:${zone}:${k}`))() * 120);
      const t = date.getTime() + 9.5 * HOUR_MS + minute * 60_000;
      if (t <= from || t > to) continue;
      result.push({
        id: `sim-${crewMember}-daily-action-${zone}-${t}`,
        indicator: 'daily-action',
        value: zone,
        unit: '',
        takenAt: new Date(t).toISOString(),
        source: 'screen',
        simulated: false,
        crewMember,
      });
    }
  }
  return result;
}

export function demoHistory(
  crewMember: string,
  now: Date,
  options?: DemoHistoryOptions,
): Reading[] {
  const to = now.getTime();
  const from = to - (options?.days ?? 30) * DAY_MS;
  const config = options?.config ?? contentConfig();
  const ids =
    options?.indicators ??
    (config
      ? config.indicators.map((i) => i.id).filter((id) => SERIES_BY_INDICATOR[id])
      : SERIES.map((s) => s.indicator));
  const opts = { ...options, config, anchor: options?.anchor ?? to };
  const marks =
    (options?.dailyActions ?? !options?.indicators)
      ? dailyActionMarks(crewMember, from, to, config)
      : [];
  return [...ids.flatMap((id) => generateSeries(crewMember, id, from, to, opts)), ...marks].sort(
    (a, b) => a.takenAt.localeCompare(b.takenAt),
  );
}
