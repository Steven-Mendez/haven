import type { Environment, Mission, Reading } from '../contracts';
import { DAY_MS, dayKey, mean, ms, numeric, round } from './util';

export const CAREER_LIMIT_MSV = 600;
export const WATCH_PERCENT = 70;
export const EVENT_BUDGET_MSV = 25;
export const DEMO_MISSION_DAYS = 540;

export type RadiationOptions = {
  durationDays?: number;
  careerLimitMSv?: number;
  watchPercent?: number;
  indicator?: string;
};

export type RadiationDose = {
  cumulativeMSv: number;
  careerLimitPercent: number;
  projectedMSv: number;
  estimate: true;
  watch: boolean;
  dailyMeanMSv: number;
  remainingDays: number;
  estimatedDays: number;
};

export function radiationDose(
  readings: Reading[],
  mission: Mission,
  environment: Environment,
  now: Date,
  options?: RadiationOptions,
): RadiationDose {
  const indicator = options?.indicator ?? 'radiation-dose';
  const limit = options?.careerLimitMSv ?? CAREER_LIMIT_MSV;
  const duration = options?.durationDays ?? DEMO_MISSION_DAYS;
  const byDay = new Map<string, number[]>();
  for (const r of readings) {
    if (r.indicator !== indicator || ms(r.takenAt) > now.getTime()) continue;
    const v = numeric(r);
    if (v === undefined) continue;
    const d = dayKey(r.takenAt);
    byDay.set(d, [...(byDay.get(d) ?? []), v]);
  }
  const days = [...byDay.entries()].map(([date, vs]) => ({ date, dose: mean(vs) }));
  const measured = days.reduce((s, d) => s + d.dose, 0);
  const since = dayKey(new Date(now.getTime() - 30 * DAY_MS));
  const recent = days.filter((d) => d.date > since);
  const reference = environment.dailyDoseMSv ?? 0;
  const dailyMean = recent.length > 0 ? mean(recent.map((d) => d.dose)) : reference;
  const estimatedDays = Math.max(0, mission.day - days.length);
  const cumulative = measured + estimatedDays * reference;
  const remainingDays = Math.max(0, duration - mission.day);
  const percent = limit > 0 ? (cumulative / limit) * 100 : 0;
  return {
    cumulativeMSv: round(cumulative, 1),
    careerLimitPercent: round(percent, 1),
    projectedMSv: round(cumulative + dailyMean * remainingDays, 1),
    estimate: true,
    watch: percent >= (options?.watchPercent ?? WATCH_PERCENT),
    dailyMeanMSv: round(dailyMean, 3),
    remainingDays,
    estimatedDays,
  };
}

export function timeOutsideShelter(params: {
  todayDoseMSv: number;
  localRateMSvH?: number;
  shielding?: number;
  budgetMSv?: number;
}): number | null {
  const { todayDoseMSv, localRateMSvH, shielding } = params;
  if (!localRateMSvH || !shielding || localRateMSvH <= 0 || shielding <= 0) return null;
  const left = (params.budgetMSv ?? EVENT_BUDGET_MSV) - todayDoseMSv;
  return Math.max(0, Math.floor((left / (localRateMSvH * shielding)) * 60));
}
