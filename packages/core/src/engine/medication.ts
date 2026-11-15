import type {
  CrewPlan,
  MedicationAssignment,
  MedicationConfig,
  MedicationSchedule,
  Reading,
} from '../contracts';
import { DAY_MS, HOUR_MS, ms } from './util';

/** Reading of a dose; its value is the medication id and its note the status. */
export const MEDICATION_INDICATOR = 'medication-dose';

export type DoseStatus = 'taken' | 'skipped' | 'due' | 'upcoming' | 'missed';

export type Dose = {
  medication: string;
  scheduledAt: string;
  status: DoseStatus;
  recordedAt?: string;
};

export type AsNeeded = { medication: string; taken: number; maxPerDay: number; canTake: boolean };

export type Adherence = {
  expected: number;
  taken: number;
  skipped: number;
  missed: number;
  /** Taken over expected, 0–100; null when nothing was expected yet. */
  percent: number | null;
};

export const emptyPlan = (mission: string, crewMember: string): CrewPlan => ({
  mission,
  crewMember,
  medications: [],
  updatedAt: new Date(0).toISOString(),
});

const dayOf = (t: number) => new Date(t).toISOString().slice(0, 10);

export function scheduleOf(
  assignment: MedicationAssignment,
  cfg: MedicationConfig,
): MedicationSchedule | undefined {
  return assignment.schedule ?? cfg.catalog.find((m) => m.id === assignment.medication)?.schedule;
}

const activeOn = (a: MedicationAssignment, day: string) => !a.until || day <= a.until;

/** Scheduled doses of one mission day (YYYY-MM-DD, UTC). */
export function scheduledDoses(
  plan: CrewPlan,
  cfg: MedicationConfig,
  day: string,
): { medication: string; scheduledAt: string }[] {
  const weekday = new Date(`${day}T00:00:00Z`).getUTCDay();
  const out: { medication: string; scheduledAt: string }[] = [];
  for (const a of plan.medications) {
    const s = scheduleOf(a, cfg);
    if (!s || s.kind === 'as-needed' || !activeOn(a, day)) continue;
    if (s.kind === 'weekly' && s.weekday !== weekday) continue;
    for (const time of s.times) {
      out.push({ medication: a.medication, scheduledAt: `${day}T${time}:00.000Z` });
    }
  }
  return out.sort((x, y) => x.scheduledAt.localeCompare(y.scheduledAt));
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

type Recorded = { status: 'taken' | 'skipped'; scheduledAt?: string; at: string };

function recordedDoses(readings: Reading[], medication: string): Recorded[] {
  return readings
    .filter((r) => r.indicator === MEDICATION_INDICATOR && r.value === medication)
    .map((r) => {
      const fields = parseNote(r.note);
      return {
        status: fields.status === 'skipped' ? ('skipped' as const) : ('taken' as const),
        ...(fields.scheduled ? { scheduledAt: fields.scheduled } : {}),
        at: r.takenAt,
      };
    });
}

export function dosesForDay(
  plan: CrewPlan,
  cfg: MedicationConfig,
  readings: Reading[],
  now: Date,
  day: string = dayOf(now.getTime()),
): Dose[] {
  const window = cfg.doseWindowHours * HOUR_MS;
  return scheduledDoses(plan, cfg, day).map((d) => {
    const record = recordedDoses(readings, d.medication).find(
      (r) => r.scheduledAt === d.scheduledAt,
    );
    if (record) return { ...d, status: record.status, recordedAt: record.at };
    const at = ms(d.scheduledAt);
    const status: DoseStatus =
      now.getTime() < at ? 'upcoming' : now.getTime() <= at + window ? 'due' : 'missed';
    return { ...d, status };
  });
}

export function asNeededToday(
  plan: CrewPlan,
  cfg: MedicationConfig,
  readings: Reading[],
  now: Date,
): AsNeeded[] {
  const today = dayOf(now.getTime());
  return plan.medications.flatMap((a) => {
    const s = scheduleOf(a, cfg);
    if (s?.kind !== 'as-needed' || !activeOn(a, today)) return [];
    const taken = recordedDoses(readings, a.medication).filter(
      (r) => r.status === 'taken' && !r.scheduledAt && r.at.slice(0, 10) === today,
    ).length;
    return [
      { medication: a.medication, taken, maxPerDay: s.maxPerDay, canTake: taken < s.maxPerDay },
    ];
  });
}

export function doseReading(
  medication: string,
  dose: { status: 'taken' | 'skipped'; scheduledAt?: string },
  options: { crewMember: string; takenAt: string; newId: () => string },
): Reading {
  return {
    id: options.newId(),
    indicator: MEDICATION_INDICATOR,
    value: medication,
    unit: '',
    takenAt: options.takenAt,
    source: 'manual',
    simulated: false,
    crewMember: options.crewMember,
    note: `status=${dose.status}${dose.scheduledAt ? `;scheduled=${dose.scheduledAt}` : ''}`,
  };
}

/**
 * Scheduled doses of the last `days` days, today included, that are already
 * closed or recorded. Doses before `since` (when the crew member started using
 * the app) do not count.
 */
export function adherence(
  plan: CrewPlan,
  cfg: MedicationConfig,
  readings: Reading[],
  now: Date,
  days = 7,
  since?: string,
): Adherence {
  const from = since ? ms(since) : Number.NEGATIVE_INFINITY;
  const result = { expected: 0, taken: 0, skipped: 0, missed: 0 };
  for (let k = days - 1; k >= 0; k--) {
    const day = dayOf(now.getTime() - k * DAY_MS);
    for (const dose of dosesForDay(plan, cfg, readings, now, day)) {
      if (dose.status === 'upcoming' || dose.status === 'due') continue;
      if (ms(dose.scheduledAt) < from) continue;
      result.expected++;
      result[dose.status]++;
    }
  }
  return {
    ...result,
    percent: result.expected ? Math.round((result.taken / result.expected) * 100) : null,
  };
}

const TIME = /^([01]\d|2[0-3]):[0-5]\d$/;
const DATE = /^\d{4}-\d{2}-\d{2}$/;

function validSchedule(s: unknown): s is MedicationSchedule {
  if (!s || typeof s !== 'object') return false;
  const v = s as Record<string, unknown>;
  const times =
    Array.isArray(v.times) && v.times.length > 0 && v.times.every((t) => TIME.test(String(t)));
  if (v.kind === 'daily') return times;
  if (v.kind === 'weekly')
    return times && Number.isInteger(v.weekday) && Number(v.weekday) >= 0 && Number(v.weekday) <= 6;
  if (v.kind === 'as-needed') return Number.isInteger(v.maxPerDay) && Number(v.maxPerDay) > 0;
  return false;
}

/**
 * Keeps the assignments of known medications with a valid schedule, end date and
 * note; anything else is dropped. Used by the API, the web form and the app.
 */
export function cleanAssignments(input: unknown, cfg: MedicationConfig): MedicationAssignment[] {
  if (!Array.isArray(input)) return [];
  const known = new Set(cfg.catalog.map((m) => m.id));
  const seen = new Set<string>();
  const out: MedicationAssignment[] = [];
  for (const raw of input) {
    if (!raw || typeof raw !== 'object') continue;
    const a = raw as Record<string, unknown>;
    const id = String(a.medication ?? '');
    if (!known.has(id) || seen.has(id)) continue;
    seen.add(id);
    out.push({
      medication: id,
      ...(validSchedule(a.schedule) ? { schedule: a.schedule } : {}),
      ...(typeof a.until === 'string' && DATE.test(a.until) ? { until: a.until } : {}),
      ...(typeof a.note === 'string' && a.note.trim() ? { note: a.note.trim().slice(0, 200) } : {}),
    });
  }
  return out;
}
