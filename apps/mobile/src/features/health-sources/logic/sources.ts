import type { Reading, ReadingSource } from '@haven/core';

// M07 · Which source feeds each indicator, and what a provider's state means for it. Pure.

export type SourceId = 'healthkit' | 'pedometer' | 'healthconnect' | 'ble' | 'watch' | 'manual';

/**
 * - `connected`: delivering data.
 * - `needsPermission`: available, permission not asked yet.
 * - `denied`: the permission was refused (or HealthKit returns nothing after asking: iOS hides read
 *   refusals, so "asked and no data at all" is treated as refused).
 * - `unavailable`: not on this device/build (Health Connect, BLE, HealthKit on Android/web).
 * - `inactive`: available but not in use (no watch paired).
 */
export type SourceState = 'connected' | 'needsPermission' | 'denied' | 'unavailable' | 'inactive';

export type SourceStatus = {
  id: SourceId;
  state: SourceState;
  /** Indicators it can deliver. */
  indicators: readonly string[];
  /** Indicators the device itself produces (iPhone: steps, distance, floors). A refused permission
   *  leaves these pending, never green. */
  primary: readonly string[];
  /** Indicators it has actually delivered data for. */
  withData: readonly string[];
  /** i18n key of the reason when unavailable/denied. */
  reason?: string;
  lastSyncAt?: string;
};

/** Real providers, by priority: HealthKit wins over the watch (dedupe) and over the pedometer. */
export const REAL_PRIORITY: SourceId[] = [
  'healthkit',
  'pedometer',
  'healthconnect',
  'ble',
  'watch',
];

export type IndicatorPlan = {
  indicator: string;
  /** Who feeds it now. `manual` = no provider: manual entry (or the latest reading's own source). */
  source: SourceId;
  /** `pending` when the provider that should feed it was refused permission. */
  mode: 'provider' | 'manual' | 'pending';
  /** The refused provider, for "how to grant it". */
  deniedBy?: SourceId;
};

/**
 * Plan for one indicator:
 * 1. a connected provider that already delivered data for it → `provider`;
 * 2. a provider for which it is primary, refused → `pending` (never green);
 * 3. otherwise manual entry (the screen then shows the latest reading's source, if any).
 */
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

/** Latest reading per indicator (readings sorted by `takenAt`). */
export function latestByIndicator(readings: Reading[]): Map<string, Reading> {
  const out = new Map<string, Reading>();
  for (const r of readings) out.set(r.indicator, r);
  return out;
}

/** `YYYY-MM-DD` of a date in local time (daily totals follow the phone's day). */
export function localDay(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/**
 * A daily total (steps, distance, floors) as a Reading. The id changes only when the total changes,
 * so re-syncing the same total stores nothing new (the store skips known ids).
 */
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

/** HealthKit sleep values that count as asleep (asleepUnspecified, core, deep, REM). */
export const ASLEEP_VALUES = [1, 3, 4, 5];

/**
 * Hours asleep per night: asleep segments grouped by the local day they end on (the morning).
 * Overlapping segments from several sources are not merged: HealthKit returns one source here.
 */
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
