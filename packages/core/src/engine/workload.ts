import type { Level, Reading, WorkloadConfig } from '../contracts';
import { DAY_MS, numeric } from './util';

export const WORK_HOURS_INDICATOR = 'work-hours';
export const FATIGUE_INDICATOR = 'fatigue';
const SLEEP_INDICATOR = 'sleep';

/** One mission day (UTC): hours worked, worst fatigue and the night's sleep, null when not logged. */
export type WorkDay = {
  day: string;
  hours: number | null;
  fatigue: number | null;
  sleep: number | null;
};

export type WorkloadReason =
  | 'week-hours'
  | 'long-streak'
  | 'over-max'
  | 'no-rest'
  | 'fatigue'
  | 'fatigue-short-sleep';

export type WorkloadStatus = {
  level: Level;
  reasons: WorkloadReason[];
  /** Hours logged in the last 7 days and the days with a log. */
  weekHours: number;
  loggedDays: number;
  /** Long days in a row up to the last logged one. */
  longStreak: number;
  restDays: number;
  latestFatigue: number | null;
  /** Average sleep of the nights with data, in hours. */
  averageSleep: number | null;
};

const dayOf = (t: number) => new Date(t).toISOString().slice(0, 10);

/** Largest value of an indicator on a UTC day, or null. */
function dayValue(readings: Reading[], indicator: string, day: string): number | null {
  let best: number | null = null;
  for (const r of readings) {
    if (r.indicator !== indicator || r.takenAt.slice(0, 10) !== day) continue;
    const v = numeric(r);
    if (v !== undefined && (best === null || v > best)) best = v;
  }
  return best;
}

/** The last `days` mission days, oldest first, today last. */
export function workDays(readings: Reading[], now: Date, days = 7): WorkDay[] {
  const out: WorkDay[] = [];
  for (let k = days - 1; k >= 0; k--) {
    const day = dayOf(now.getTime() - k * DAY_MS);
    out.push({
      day,
      hours: dayValue(readings, WORK_HOURS_INDICATOR, day),
      fatigue: dayValue(readings, FATIGUE_INDICATOR, day),
      sleep: dayValue(readings, SLEEP_INDICATOR, day),
    });
  }
  return out;
}

export function fatigueLevel(score: number, cfg: WorkloadConfig): Level {
  if (score >= cfg.fatigue.red) return 'red';
  if (score >= cfg.fatigue.amber) return 'amber';
  return 'green';
}

export function dayHoursLevel(hours: number, cfg: WorkloadConfig): Level {
  if (hours > cfg.day.max) return 'red';
  if (hours > cfg.day.long) return 'amber';
  return 'green';
}

/**
 * The week at a glance: red with more than the weekly maximum, very high
 * fatigue, or high fatigue after a short night; amber with a heavy week,
 * several long days in a row, a day over the maximum, a full week without
 * rest or high fatigue.
 */
export function workloadStatus(days: WorkDay[], cfg: WorkloadConfig): WorkloadStatus {
  const logged = days.filter((d) => d.hours !== null);
  const weekHours = Math.round(logged.reduce((sum, d) => sum + (d.hours ?? 0), 0) * 10) / 10;
  let longStreak = 0;
  for (const d of [...logged].reverse()) {
    if ((d.hours ?? 0) > cfg.day.long) longStreak++;
    else break;
  }
  const restDays = logged.filter((d) => (d.hours ?? 0) <= cfg.day.rest).length;
  const lastFatigue = [...days].reverse().find((d) => d.fatigue !== null);
  const latestFatigue = lastFatigue?.fatigue ?? null;
  const nights = days.filter((d) => d.sleep !== null);
  const averageSleep = nights.length
    ? Math.round((nights.reduce((sum, d) => sum + (d.sleep ?? 0), 0) / nights.length) * 10) / 10
    : null;

  const red: WorkloadReason[] = [];
  const amber: WorkloadReason[] = [];
  if (weekHours >= cfg.week.red) red.push('week-hours');
  else if (weekHours >= cfg.week.amber) amber.push('week-hours');
  if (longStreak >= cfg.week.longStreak) amber.push('long-streak');
  if (logged.some((d) => (d.hours ?? 0) > cfg.day.max)) amber.push('over-max');
  if (logged.length >= days.length && restDays < cfg.week.minRestDays) amber.push('no-rest');
  if (latestFatigue !== null && lastFatigue) {
    const level = fatigueLevel(latestFatigue, cfg);
    const shortNight = lastFatigue.sleep !== null && lastFatigue.sleep < cfg.shortSleep;
    if (level === 'red') red.push('fatigue');
    else if (level === 'amber' && shortNight) red.push('fatigue-short-sleep');
    else if (level === 'amber') amber.push('fatigue');
  }

  const level: Level = red.length
    ? 'red'
    : amber.length
      ? 'amber'
      : logged.length === 0 && latestFatigue === null
        ? 'pending'
        : 'green';
  return {
    level,
    reasons: [...red, ...amber],
    weekHours,
    loggedDays: logged.length,
    longStreak,
    restDays,
    latestFatigue,
    averageSleep,
  };
}

/** Hour (UTC) from which the day's hours can be logged. */
export const WORKDAY_END_HOUR = 15;

/**
 * What Routine reminds about workload: rest when the status is red; otherwise,
 * at the end of the workday, logging today's hours and fatigue.
 */
export function workloadReminder(
  readings: Reading[],
  cfg: WorkloadConfig,
  now: Date,
): 'rest' | 'log' | undefined {
  const days = workDays(readings, now);
  if (workloadStatus(days, cfg).level === 'red') return 'rest';
  const today = days.at(-1);
  if (now.getUTCHours() >= WORKDAY_END_HOUR && today?.hours === null) return 'log';
  return undefined;
}

/** Hours of a log: 0–24 in half hours. */
export function parseWorkHours(text: string): number | undefined {
  const trimmed = text.trim().replace(',', '.');
  if (!/^\d{1,2}(\.\d)?$/.test(trimmed)) return undefined;
  const n = Number(trimmed);
  return n >= 0 && n <= 24 && Number.isInteger(n * 2) ? n : undefined;
}

type ReadingOptions = { crewMember: string; takenAt: string; newId: () => string };

export function workHoursReading(hours: number, options: ReadingOptions): Reading {
  return {
    id: options.newId(),
    indicator: WORK_HOURS_INDICATOR,
    value: hours,
    unit: 'h',
    takenAt: options.takenAt,
    source: 'manual',
    simulated: false,
    crewMember: options.crewMember,
  };
}

export function fatigueReading(score: number, options: ReadingOptions): Reading {
  return {
    id: options.newId(),
    indicator: FATIGUE_INDICATOR,
    value: score,
    unit: 'points (1–7)',
    takenAt: options.takenAt,
    source: 'manual',
    simulated: false,
    crewMember: options.crewMember,
  };
}
