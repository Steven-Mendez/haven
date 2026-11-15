import type {
  CrewPlan,
  ExerciseConfig,
  ExerciseKind,
  ExercisePrescription,
  Level,
  Reading,
} from '../contracts';
import { DAY_MS, ms, numeric } from './util';

export const EXERCISE_KINDS: readonly ExerciseKind[] = ['resistance', 'aerobic'];

/**
 * A manual reading is one session; HealthKit sends the day's running total, so
 * only its largest value counts.
 */
export const EXERCISE_INDICATOR: Record<ExerciseKind, string> = {
  resistance: 'resistance-exercise',
  aerobic: 'aerobic-exercise',
};

/** Weekly self-assessment; its value is the perceived effort (0–10). */
export const EXERCISE_ASSESSMENT_INDICATOR = 'exercise-assessment';

export type ExercisePain = 'none' | 'mild' | 'strong';
export type ExerciseCompletion = 'full' | 'partial' | 'none';
export const EXERCISE_PAIN: readonly ExercisePain[] = ['none', 'mild', 'strong'];
export const EXERCISE_COMPLETION: readonly ExerciseCompletion[] = ['full', 'partial', 'none'];

export type ExerciseMinutes = Record<ExerciseKind, number>;

/**
 * met: both kinds reached; partial: some exercise, not all; rest: none;
 * open: today, still in progress; before: before the crew member's first data.
 */
export type ExerciseDayStatus = 'met' | 'partial' | 'rest' | 'open' | 'before';

export type ExerciseDay = { day: string; minutes: ExerciseMinutes; status: ExerciseDayStatus };

export type ExerciseCompliance = {
  /** Days that count: closed days since the first data, plus today once met. */
  counted: number;
  met: number;
  /** Days the prescription asks for within the counted days. */
  target: number;
  level: Level;
};

export type ExerciseAssessment = {
  effort: number;
  pain: ExercisePain;
  completion: ExerciseCompletion;
  at: string;
};

/** What the self-assessment suggests to Earth about the prescription. */
export type ExerciseSuggestion = 'raise' | 'keep' | 'lower';

const dayOf = (t: number) => new Date(t).toISOString().slice(0, 10);

export function prescriptionOf(
  plan: Pick<CrewPlan, 'exercise'> | undefined,
  cfg: ExerciseConfig,
): ExercisePrescription {
  return plan?.exercise ?? cfg.prescription;
}

export const targetMinutes = (p: ExercisePrescription): ExerciseMinutes => ({
  resistance: p.resistanceMinutes,
  aerobic: p.aerobicMinutes,
});

/** Minutes of each kind on one mission day (YYYY-MM-DD, UTC). */
export function dayMinutes(readings: Reading[], day: string): ExerciseMinutes {
  const total = (kind: ExerciseKind) => {
    const todays = readings.filter(
      (r) => r.indicator === EXERCISE_INDICATOR[kind] && r.takenAt.slice(0, 10) === day,
    );
    const sessions = todays
      .filter((r) => r.source !== 'healthkit')
      .reduce((sum, r) => sum + (numeric(r) ?? 0), 0);
    const synced = todays
      .filter((r) => r.source === 'healthkit')
      .reduce((max, r) => Math.max(max, numeric(r) ?? 0), 0);
    return sessions + synced;
  };
  return { resistance: total('resistance'), aerobic: total('aerobic') };
}

export function isMet(minutes: ExerciseMinutes, p: ExercisePrescription): boolean {
  return minutes.resistance >= p.resistanceMinutes && minutes.aerobic >= p.aerobicMinutes;
}

/** The last `days` mission days, oldest first, today last. */
export function exerciseWeek(
  readings: Reading[],
  p: ExercisePrescription,
  now: Date,
  since?: string,
  days = 7,
): ExerciseDay[] {
  const today = dayOf(now.getTime());
  const first = since ? since.slice(0, 10) : undefined;
  const out: ExerciseDay[] = [];
  for (let k = days - 1; k >= 0; k--) {
    const day = dayOf(now.getTime() - k * DAY_MS);
    const minutes = dayMinutes(readings, day);
    const status: ExerciseDayStatus = isMet(minutes, p)
      ? 'met'
      : day === today
        ? 'open'
        : !first || day < first
          ? 'before'
          : minutes.resistance + minutes.aerobic > 0
            ? 'partial'
            : 'rest';
    out.push({ day, minutes, status });
  }
  return out;
}

/**
 * Training days against the prescription: with 6 days a week, one rest day in
 * seven is fine. One day short is amber; two or more, red.
 */
export function exerciseCompliance(
  week: ExerciseDay[],
  p: ExercisePrescription,
): ExerciseCompliance {
  const counted = week.filter((d) => d.status !== 'open' && d.status !== 'before').length;
  const met = week.filter((d) => d.status === 'met').length;
  const target = Math.floor((counted * p.daysPerWeek) / week.length);
  const level: Level =
    counted === 0 ? 'pending' : met >= target ? 'green' : met >= target - 1 ? 'amber' : 'red';
  return { counted, met, target, level };
}

function parseNote(note: string | undefined): Record<string, string> {
  return Object.fromEntries(
    (note ?? '')
      .split(';')
      .filter(Boolean)
      .map((part) => {
        const [key = '', ...rest] = part.split('=');
        return [key.trim(), rest.join('=').trim()];
      }),
  );
}

export function latestAssessment(readings: Reading[]): ExerciseAssessment | undefined {
  const last = readings
    .filter((r) => r.indicator === EXERCISE_ASSESSMENT_INDICATOR)
    .sort((a, b) => ms(b.takenAt) - ms(a.takenAt))[0];
  const effort = last ? numeric(last) : undefined;
  if (!last || effort === undefined) return undefined;
  const fields = parseNote(last.note);
  return {
    effort,
    pain: EXERCISE_PAIN.find((p) => p === fields.pain) ?? 'none',
    completion: EXERCISE_COMPLETION.find((c) => c === fields.completion) ?? 'full',
    at: last.takenAt,
  };
}

/**
 * A self-assessment is due every `everyDays` days, counted from the last one or,
 * without any, from the crew member's first data.
 */
export function assessmentDue(
  latest: ExerciseAssessment | undefined,
  cfg: ExerciseConfig,
  now: Date,
  since?: string,
): boolean {
  const from = latest?.at ?? since;
  if (!from) return false;
  return now.getTime() - ms(from) >= cfg.assessment.everyDays * DAY_MS;
}

export function assessmentSuggestion(
  a: ExerciseAssessment,
  cfg: ExerciseConfig,
): ExerciseSuggestion {
  if (a.pain === 'strong' || a.completion === 'none' || a.effort >= cfg.assessment.hardEffort) {
    return 'lower';
  }
  if (a.effort <= cfg.assessment.easyEffort && a.completion === 'full' && a.pain === 'none') {
    return 'raise';
  }
  return 'keep';
}

const within = (n: unknown, [min, max]: [number, number]) =>
  typeof n === 'number' && Number.isInteger(n) && n >= min && n <= max;

/** A valid prescription from untrusted input (API, form or download), or undefined. */
export function cleanPrescription(
  input: unknown,
  cfg: ExerciseConfig,
): ExercisePrescription | undefined {
  if (!input || typeof input !== 'object') return undefined;
  const v = input as Record<string, unknown>;
  const { minutes, daysPerWeek } = cfg.limits;
  if (!within(v.resistanceMinutes, minutes) || !within(v.aerobicMinutes, minutes)) return undefined;
  if (!within(v.daysPerWeek, daysPerWeek)) return undefined;
  if (v.resistanceMinutes === 0 && v.aerobicMinutes === 0) return undefined;
  return {
    resistanceMinutes: v.resistanceMinutes as number,
    aerobicMinutes: v.aerobicMinutes as number,
    daysPerWeek: v.daysPerWeek as number,
    ...(typeof v.note === 'string' && v.note.trim() ? { note: v.note.trim().slice(0, 200) } : {}),
  };
}

type ReadingOptions = { crewMember: string; takenAt: string; newId: () => string };

/** One exercise session; the day's minutes are the sum of its sessions. */
export function sessionReading(
  kind: ExerciseKind,
  session: { minutes: number; device?: string },
  options: ReadingOptions,
): Reading {
  return {
    id: options.newId(),
    indicator: EXERCISE_INDICATOR[kind],
    value: session.minutes,
    unit: 'min',
    takenAt: options.takenAt,
    source: 'manual',
    simulated: false,
    crewMember: options.crewMember,
    ...(session.device ? { note: `device=${session.device}` } : {}),
  };
}

export function assessmentReading(
  a: Omit<ExerciseAssessment, 'at'>,
  options: ReadingOptions,
): Reading {
  return {
    id: options.newId(),
    indicator: EXERCISE_ASSESSMENT_INDICATOR,
    value: a.effort,
    unit: '',
    takenAt: options.takenAt,
    source: 'manual',
    simulated: false,
    crewMember: options.crewMember,
    note: `pain=${a.pain};completion=${a.completion}`,
  };
}

/** When the crew member's own data starts: the week and the self-assessment count from here. */
export function firstDataAt(readings: Reading[]): string | undefined {
  let first: string | undefined;
  for (const r of readings) {
    if (r.simulated) continue;
    if (!first || r.takenAt < first) first = r.takenAt;
  }
  return first;
}

export type ExerciseReminder =
  | { kind: 'assessment' }
  | { kind: 'today'; done: number; target: number };

/**
 * What Routine reminds about exercise: the weekly self-assessment when it is
 * due; otherwise today's minutes while the prescription is not met.
 */
export function exerciseReminder(
  readings: Reading[],
  p: ExercisePrescription,
  cfg: ExerciseConfig,
  now: Date,
): ExerciseReminder | undefined {
  if (assessmentDue(latestAssessment(readings), cfg, now, firstDataAt(readings))) {
    return { kind: 'assessment' };
  }
  const today = dayMinutes(readings, dayOf(now.getTime()));
  if (isMet(today, p)) return undefined;
  const done =
    Math.min(today.resistance, p.resistanceMinutes) + Math.min(today.aerobic, p.aerobicMinutes);
  return { kind: 'today', done, target: p.resistanceMinutes + p.aerobicMinutes };
}
