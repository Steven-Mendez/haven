import type { Reading, ReadingSource } from '@haven/core';

export type SourceId = 'healthkit' | 'pedometer' | 'healthconnect' | 'ble' | 'watch' | 'manual';

export type SourceState = 'connected' | 'needsPermission' | 'denied' | 'unavailable' | 'inactive';

export type SourceStatus = {
  id: SourceId;
  state: SourceState;
  indicators: readonly string[];
  primary: readonly string[];
  withData: readonly string[];
  reason?: string;
  lastSyncAt?: string;
};

export const REAL_PRIORITY: SourceId[] = [
  'healthkit',
  'pedometer',
  'healthconnect',
  'ble',
  'watch',
];

export type IndicatorPlan = {
  indicator: string;
  source: SourceId;
  mode: 'provider' | 'manual' | 'pending';
  deniedBy?: SourceId;
};

export function planIndicator(indicator: string, statuses: SourceStatus[]): IndicatorPlan {
  const byId = new Map(statuses.map((s) => [s.id, s]));
  for (const id of REAL_PRIORITY) {
    const s = byId.get(id);
    if (s?.state === 'connected' && s.withData.includes(indicator)) {
      return { indicator, source: id, mode: 'provider' };
    }
  }
  for (const id of REAL_PRIORITY) {
    const s = byId.get(id);
    if (s?.state === 'denied' && s.primary.includes(indicator)) {
      return { indicator, source: id, mode: 'pending', deniedBy: id };
    }
  }
  return { indicator, source: 'manual', mode: 'manual' };
}

export function planIndicators(indicators: string[], statuses: SourceStatus[]): IndicatorPlan[] {
  return indicators.map((id) => planIndicator(id, statuses));
}

export function latestByIndicator(readings: Reading[]): Map<string, Reading> {
  const out = new Map<string, Reading>();
  for (const r of readings) out.set(r.indicator, r);
  return out;
}

export function localDay(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function dailyTotalReading(input: {
  provider: 'healthkit' | 'pedometer';
  source: ReadingSource;
  indicator: string;
  unit: string;
  total: number;
  decimals: number;
  day: Date;
  takenAt: Date;
  crewMember: string;
}): Reading {
  const factor = 10 ** input.decimals;
  const value = Math.round(input.total * factor) / factor;
  return {
    id: `${input.provider}:${input.indicator}:${localDay(input.day)}:${value}`,
    indicator: input.indicator,
    value,
    unit: input.unit,
    takenAt: input.takenAt.toISOString(),
    source: input.source,
    simulated: false,
    crewMember: input.crewMember,
  };
}

export const ASLEEP_VALUES = [1, 3, 4, 5];

export function sleepNights(
  samples: { start: Date; end: Date; value: number }[],
): { day: string; hours: number; end: Date }[] {
  const nights = new Map<string, { ms: number; end: Date }>();
  for (const s of samples) {
    if (!ASLEEP_VALUES.includes(s.value)) continue;
    const day = localDay(s.end);
    const night = nights.get(day) ?? { ms: 0, end: s.end };
    night.ms += Math.max(0, s.end.getTime() - s.start.getTime());
    if (s.end > night.end) night.end = s.end;
    nights.set(day, night);
  }
  return [...nights.entries()]
    .map(([day, n]) => ({ day, hours: Math.round((n.ms / 3_600_000) * 10) / 10, end: n.end }))
    .sort((a, b) => a.day.localeCompare(b.day));
}
