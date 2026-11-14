import type { Config, Reading, Zone } from '../contracts';
import { DAY_MS, dayKey, ms, numeric, previousDay } from './util';
import { zoneIndicatorIds } from './zones';

export const DAILY_ACTION_INDICATOR = 'daily-action';
export const BATTERY_INDICATORS = [
  'reaction-time',
  'pvt-lapses',
  'working-memory',
  'go-nogo-accuracy',
] as const;
export const WELLBEING_INDICATORS = ['mood', 'stress'] as const;

export const ACTION_SCREENS: Record<string, readonly string[]> = {
  cognition: BATTERY_INDICATORS,
  wellbeing: WELLBEING_INDICATORS,
};
const SHELTER_OPENS = new Set(['solar-event', 'radiation-shelter', 'shelter']);
const SHELTER_SCALE = 2;

export type RoutineOptions = {
  offsetMin?: number;
};

export type ZoneProgress = { zone: string; progress: number };
export type DayRecord = { date: string; complete: boolean };

export function dailyProgress(
  readings: Reading[],
  config: Config,
  now: Date,
  options?: RoutineOptions,
): ZoneProgress[] {
  const offset = options?.offsetMin ?? 0;
  const today = dayKey(now, offset);
  const end = now.getTime();
  const todays = readings.filter(
    (r) => ms(r.takenAt) <= end && dayKey(r.takenAt, offset) === today,
  );
  return config.zones.map((zone) => ({
    zone: zone.id,
    progress: Math.min(1, Math.max(0, zoneProgress(zone, todays, config))),
  }));
}

function zoneProgress(zone: Zone, todays: Reading[], config: Config): number {
  if (todays.some((r) => r.indicator === DAILY_ACTION_INDICATOR && String(r.value) === zone.id)) {
    return 1;
  }
  const opens = zone.dailyAction.opens;
  const has = (id: string) => todays.some((r) => r.indicator === id);
  const ids = zoneIndicatorIds(config, zone.id);
  if (SHELTER_OPENS.has(opens) || (opens === 'routine' && ids.has('solar-event'))) {
    const last = todays
      .filter((r) => r.indicator === 'solar-event')
      .sort((a, b) => ms(a.takenAt) - ms(b.takenAt))
      .at(-1);
    return !last || (numeric(last) ?? 0) < SHELTER_SCALE ? 1 : 0;
  }
  const indicator = config.indicators.find((i) => i.id === opens);
  if (indicator) {
    if (indicator.unit === 'min' && zone.dailyAction.minutes > 0) {
      const minutes = todays
        .filter((r) => r.indicator === opens)
        .reduce((s, r) => s + (numeric(r) ?? 0), 0);
      return minutes / zone.dailyAction.minutes;
    }
    return has(opens) ? 1 : 0;
  }
  const screen = ACTION_SCREENS[opens];
  if (screen) return screen.filter(has).length / screen.length;
  if (opens === 'routine') return 0;
  return todays.some((r) => ids.has(r.indicator) && r.source !== 'ship') ? 1 : 0;
}

export function actionsDone(progress: ZoneProgress[]): number {
  return progress.filter((p) => p.progress >= 1).length;
}

export function isDayComplete(progress: ZoneProgress[]): boolean {
  return progress.length > 0 && progress.every((p) => p.progress >= 1);
}

export function streak(days: DayRecord[], today: string): number {
  const complete = new Set(days.filter((d) => d.complete).map((d) => d.date));
  let n = complete.has(today) ? 1 : 0;
  let d = previousDay(today);
  while (complete.has(d)) {
    n++;
    d = previousDay(d);
  }
  return n;
}

export function weekCount(days: DayRecord[], today: string): number {
  const complete = new Set(days.filter((d) => d.complete).map((d) => d.date));
  let n = 0;
  let d = today;
  for (let i = 0; i < 7; i++) {
    if (complete.has(d)) n++;
    d = previousDay(d);
  }
  return n;
}

export function dayHistory(
  readings: Reading[],
  config: Config,
  now: Date,
  count = 30,
  options?: RoutineOptions,
): DayRecord[] {
  const offset = options?.offsetMin ?? 0;
  const today = dayKey(now, offset);
  const result: DayRecord[] = [];
  for (let i = count - 1; i >= 0; i--) {
    const date = new Date(ms(`${today}T00:00:00.000Z`) - i * DAY_MS).toISOString().slice(0, 10);
    const endOfDay = i === 0 ? now : new Date(ms(`${date}T23:59:59.999Z`) - offset * 60_000);
    result.push({
      date,
      complete: isDayComplete(dailyProgress(readings, config, endOfDay, options)),
    });
  }
  return result;
}
