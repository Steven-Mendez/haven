import {
  ACTION_SCREENS,
  type Assessment,
  type Config,
  configForEnvironment,
  DAILY_ACTION_INDICATOR,
  type DayRecord,
  evaluate,
  LEVEL_ORDER,
  type Level,
  type Reading,
  type Zone,
  type ZoneProgress,
} from '@haven/core';

const HOUR_MS = 3_600_000;

export type ActionTarget =
  | { kind: 'indicator'; indicator: string }
  | { kind: 'screen'; screen: 'cognition' | 'wellbeing' }
  | { kind: 'mark' };

export function actionTarget(zone: Zone, config: Config): ActionTarget {
  const opens = zone.dailyAction.opens;
  if (opens === 'cognition' || opens === 'wellbeing') return { kind: 'screen', screen: opens };
  if (config.indicators.some((i) => i.id === opens)) return { kind: 'indicator', indicator: opens };
  return { kind: 'mark' };
}

export function canMarkDone(zone: Zone, config: Config): boolean {
  const target = actionTarget(zone, config);
  if (target.kind === 'mark') return true;
  if (target.kind !== 'indicator') return false;
  const indicator = config.indicators.find((i) => i.id === target.indicator);
  return indicator?.unit === 'min' || target.indicator === 'solar-event';
}

export function dailyActionReading(
  zone: string,
  options: { id: string; crewMember: string; takenAt: string },
): Reading {
  return {
    id: options.id,
    indicator: DAILY_ACTION_INDICATOR,
    value: zone,
    unit: '',
    takenAt: options.takenAt,
    source: 'manual',
    simulated: false,
    crewMember: options.crewMember,
  };
}

export const CHECKIN_UNDO_MS = 5_000;

export function scaleReadings(
  mood: number,
  stress: number,
  options: {
    crewMember: string;
    takenAt: string;
    newId: () => string;
    unitOf: (id: string) => string;
  },
): Reading[] {
  const base = {
    source: 'screen' as const,
    simulated: false,
    crewMember: options.crewMember,
    takenAt: options.takenAt,
  };
  return [
    { id: options.newId(), indicator: 'mood', value: mood, unit: options.unitOf('mood'), ...base },
    {
      id: options.newId(),
      indicator: 'stress',
      value: stress,
      unit: options.unitOf('stress'),
      ...base,
    },
  ];
}

export function todayCheckin(
  readings: Reading[],
  today: string,
): { mood: Reading; stress: Reading } | undefined {
  const last = (id: string) =>
    readings.filter((r) => r.indicator === id && r.takenAt.slice(0, 10) === today).at(-1);
  const mood = last('mood');
  const stress = last('stress');
  return mood && stress ? { mood, stress } : undefined;
}

export const SKIP_COLLECTION = 'routine_skips';
export type SkipRecord = { id: string; date: string; zone: string; crewMember: string };

export function skipId(date: string, zone: string, crewMember: string): string {
  return `${crewMember}:${date}:${zone}`;
}

export type DailyItem = {
  zone: string;
  progress: number;
  level: Level;
  minutes: number;
  target: ActionTarget;
};

function rank(level: Level): number {
  return -LEVEL_ORDER[level];
}

export function dailyItems(
  config: Config,
  progress: ZoneProgress[],
  zoneLevels: { zone: string; level: Level }[],
): DailyItem[] {
  return config.zones.map((zone) => ({
    zone: zone.id,
    progress: progress.find((p) => p.zone === zone.id)?.progress ?? 0,
    level: zoneLevels.find((z) => z.zone === zone.id)?.level ?? 'pending',
    minutes: zone.dailyAction.minutes,
    target: actionTarget(zone, config),
  }));
}

export function nextActions(items: DailyItem[], max = 3, exclude: string[] = []): DailyItem[] {
  return items
    .map((item, order) => ({ item, order }))
    .filter(({ item }) => item.progress < 1 && !exclude.includes(item.zone))
    .sort((a, b) => rank(a.item.level) - rank(b.item.level) || a.order - b.order)
    .slice(0, max)
    .map(({ item }) => item);
}

export type DueItem = {
  key: string;
  target: ActionTarget;
  zone: string;
  everyHours: number;
  dueSince?: string;
  overdueMin: number;
  lastAt?: string;
};

export function dueMeasurements(readings: Reading[], config: Config, now: Date): DueItem[] {
  const end = now.getTime();
  const latest = new Map<string, Reading>();
  for (const r of readings) {
    if (new Date(r.takenAt).getTime() > end) continue;
    const prev = latest.get(r.indicator);
    if (!prev || r.takenAt > prev.takenAt) latest.set(r.indicator, r);
  }
  const screenOf = (id: string) =>
    (Object.keys(ACTION_SCREENS) as ('cognition' | 'wellbeing')[]).find((s) =>
      ACTION_SCREENS[s]?.includes(id),
    );

  const items = new Map<string, DueItem>();
  for (const indicator of config.indicators) {
    if (!indicator.everyHours) continue;
    const last = latest.get(indicator.id);
    if (last?.source === 'ship') continue;
    if (!last && indicator.id.startsWith('cabin-')) continue;
    const dueAt = last ? new Date(last.takenAt).getTime() + indicator.everyHours * HOUR_MS : -1;
    if (last && dueAt > end) continue;
    const screen = screenOf(indicator.id);
    const key = screen ?? indicator.id;
    const item: DueItem = {
      key,
      target: screen ? { kind: 'screen', screen } : { kind: 'indicator', indicator: indicator.id },
      zone: indicator.zone,
      everyHours: indicator.everyHours,
      dueSince: last ? new Date(dueAt).toISOString() : undefined,
      overdueMin: last ? Math.floor((end - dueAt) / 60_000) : 0,
      lastAt: last?.takenAt,
    };
    const prev = items.get(key);
    if (!prev || item.overdueMin > prev.overdueMin || (!item.lastAt && prev.lastAt)) {
      items.set(key, item);
    }
  }
  return [...items.values()].sort(
    (a, b) => Number(Boolean(a.lastAt)) - Number(Boolean(b.lastAt)) || b.overdueMin - a.overdueMin,
  );
}

export function lastSevenDays(
  history: DayRecord[],
  today: string,
): { date: string; complete: boolean; today: boolean }[] {
  return history.slice(-7).map((d) => ({ ...d, today: d.date === today }));
}

export const REST_MODULE_NOTE = 'module:rest';
export const CABIN_INDICATORS = ['cabin-co2', 'cabin-noise'] as const;

export function restModuleAtmosphere(
  readings: Reading[],
  config: Config,
  environment: string,
  now: Date,
): Assessment[] {
  const cabin = readings.filter((r) =>
    (CABIN_INDICATORS as readonly string[]).includes(r.indicator),
  );
  const rest = cabin.filter((r) => r.note === REST_MODULE_NOTE);
  const source = rest.length > 0 ? rest : cabin;
  const scoped = configForEnvironment(config, environment);
  const cfg: Config = {
    ...scoped,
    indicators: scoped.indicators.filter((i) =>
      (CABIN_INDICATORS as readonly string[]).includes(i.id),
    ),
  };
  return evaluate(source, cfg, environment, {}, [], now);
}

export type GuideExample = {
  key: 'notStarted' | 'inProgress' | 'completeAmber' | 'reopenedRed' | 'pendingReading' | 'done';
  segments: ZoneProgress[];
  level: Level;
};

const ZONE_IDS = ['heart', 'lungs', 'head', 'metabolism', 'musculoskeletal', 'skin', 'mind'];
const ring = (values: number[]): ZoneProgress[] =>
  ZONE_IDS.map((zone, i) => ({ zone, progress: values[i] ?? 0 }));

export const GUIDE_EXAMPLES: GuideExample[] = [
  { key: 'notStarted', segments: ring([0, 0, 0, 0, 0, 0, 0]), level: 'pending' },
  { key: 'inProgress', segments: ring([1, 0.5, 0, 0, 0, 1, 0]), level: 'green' },
  { key: 'completeAmber', segments: ring([1, 1, 1, 1, 1, 1, 1]), level: 'amber' },
  { key: 'reopenedRed', segments: ring([0, 1, 1, 1, 1, 1, 1]), level: 'red' },
  { key: 'pendingReading', segments: ring([1, 0, 0, 0, 0, 1, 0]), level: 'pending' },
  { key: 'done', segments: ring([1, 1, 1, 1, 1, 1, 1]), level: 'green' },
];

export function doneCount(segments: ZoneProgress[]): number {
  return segments.filter((s) => s.progress >= 1).length;
}
