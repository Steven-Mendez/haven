import type { Config, Reading, Zone } from '../contracts';
import { DAY_MS, dayKey, ms, numeric, previousDay } from './util';
import { zoneIndicatorIds } from './zones';

/** Reading the Routine (M03) saves to mark an action without a measurement done: `value` = zone id. */
export const DAILY_ACTION_INDICATOR = 'daily-action';
export const BATTERY_INDICATORS = [
  'reaction-time',
  'pvt-lapses',
  'working-memory',
  'go-nogo-accuracy',
] as const;
export const WELLBEING_INDICATORS = ['mood', 'stress'] as const;

/** Screens `dailyAction.opens` may name, and the indicators that complete them. */
export const ACTION_SCREENS: Record<string, readonly string[]> = {
  cognition: BATTERY_INDICATORS,
  wellbeing: WELLBEING_INDICATORS,
};
/** `opens` values of the shelter action: it counts by itself while there is no solar event ≥ S2. */
const SHELTER_OPENS = new Set(['solar-event', 'radiation-shelter', 'shelter']);
const SHELTER_SCALE = 2;

export type RoutineOptions = {
  /** Day boundary offset from UTC in minutes (ship time). Default 0 (UTC). */
  offsetMin?: number;
};

export type ZoneProgress = { zone: string; progress: number };
export type DayRecord = { date: string; complete: boolean };

/**
 * Progress (0..1) of each zone's daily action (M03). The day is the UTC date of `now` (shiftable with
 * `offsetMin`). Rules, in order:
 * 1. A `daily-action` reading whose `value` is the zone id marks it 100 %.
 * 2. Shelter action (`opens` = `solar-event`/`radiation-shelter`/`shelter`, or `routine` in a zone
 *    with `solar-event`): 100 % by itself unless today's latest solar event is ≥ S2.
 * 3. `opens` = indicator id: 100 % with a reading today; if its unit is `min` (exercise), today's
 *    minutes / `dailyAction.minutes`.
 * 4. `opens` = `cognition` or `wellbeing`: fraction of its indicators recorded today.
 * 5. `opens` = `routine` (an action without a measurement, e.g. checking the rest module): only the
 *    `daily-action` mark of rule 1 completes it.
 * 6. Anything else: 100 % with a reading today of one of the zone's indicators, ignoring ship
 *    telemetry (`source: 'ship'`), which never completes an action by itself.
 * Progress never changes a level; it only measures adherence.
 */
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

/** Actions resolved at 100 % (the "n" of "n/7"). An action at 50 % does not count. */
export function actionsDone(progress: ZoneProgress[]): number {
  return progress.filter((p) => p.progress >= 1).length;
}

/** A day is complete when every zone's daily action is at 100 %. */
export function isDayComplete(progress: ZoneProgress[]): boolean {
  return progress.length > 0 && progress.every((p) => p.progress >= 1);
}

/**
 * Streak of complete days (M03). Counts backwards from yesterday; today adds one if already complete
 * but never breaks the streak while it is still open. A day missing from the list is incomplete.
 */
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

/** "Week: x/7": complete days among today and the six previous days. */
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

/**
 * Complete/incomplete record of the last `count` days up to `now` (today included), computed with
 * `dailyProgress` at the end of each day. Feeds `streak` and `weekCount`.
 */
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
