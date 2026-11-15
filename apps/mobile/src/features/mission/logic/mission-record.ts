import type { Environment, Mission, MissionPhase, MissionStatus } from '@haven/core';
import { isValidMissionCode, normalizeMissionCode } from './code';
import { type CrewOption, crewFromApi, mergeCrew, missionCrew } from './crew';
import { clampDelay, defaultDelay } from './environment';

const DAY_MS = 86_400_000;

export type MissionRecord = {
  code: string;
  name: string;
  environment: string;
  destination?: string;
  start: string;
  durationDays: number;
  currentDelayMin: number;
  createdAt: string;
  origin: 'local' | 'earth';
  crew?: CrewOption[];
  status?: MissionStatus;
  awaitingStart?: true;
  finishedAt?: string;
  startAt?: string;
  /** Phase plan from Earth: environments and their days. */
  phases?: MissionPhase[];
};

export type MissionDraft = {
  name: string;
  environment: string;
  destination?: string;
  start: string;
  durationDays: string | number;
};

export type DraftError = 'name' | 'environment' | 'start' | 'duration';

export function isoDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

export function parseIsoDate(text: string): Date | undefined {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(text.trim());
  if (!match) return undefined;
  const date = new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3])));
  return isoDate(date) === text.trim() ? date : undefined;
}

export function missionDay(start: string, now: Date): number {
  const date = parseIsoDate(start);
  if (!date) return 1;
  const today = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
  return Math.max(1, Math.floor((today - date.getTime()) / DAY_MS) + 1);
}

export function startForDay(day: number, now: Date): string {
  return isoDate(new Date(now.getTime() - (Math.max(1, day) - 1) * DAY_MS));
}

export function parseDuration(value: string | number): number | undefined {
  const n = typeof value === 'number' ? value : Number(value.trim());
  return Number.isInteger(n) && n > 0 && n <= 3650 ? n : undefined;
}

export function validateDraft(
  draft: MissionDraft,
  environments: Pick<Environment, 'id'>[],
): DraftError[] {
  const errors: DraftError[] = [];
  if (draft.name.trim().length < 2 || draft.name.trim().length > 40) errors.push('name');
  if (!environments.some((e) => e.id === draft.environment)) errors.push('environment');
  if (!parseIsoDate(draft.start)) errors.push('start');
  if (parseDuration(draft.durationDays) === undefined) errors.push('duration');
  return errors;
}

export function recordFromDraft(
  draft: MissionDraft,
  code: string,
  environment: Environment,
  now: Date,
  delayMin?: number,
): MissionRecord {
  return {
    code,
    name: draft.name.trim(),
    environment: environment.id,
    destination: draft.destination,
    start: draft.start.trim(),
    durationDays: parseDuration(draft.durationDays) ?? 1,
    currentDelayMin:
      delayMin === undefined ? defaultDelay(environment) : clampDelay(environment, delayMin),
    createdAt: now.toISOString(),
    origin: 'local',
  };
}

export function recordStatus(record: MissionRecord, now: Date): MissionStatus {
  if (!record.status) return 'active';
  if (record.finishedAt || record.status === 'finished') return 'finished';
  if (record.awaitingStart || record.status === 'planned') return 'planned';
  const startMs = Date.parse(record.startAt ?? '') || parseIsoDate(record.start)?.getTime();
  if (startMs !== undefined && startMs > now.getTime()) return 'scheduled';
  return missionDay(record.start, now) > record.durationDays ? 'finished' : 'active';
}

export function recordDay(record: MissionRecord, now: Date): number {
  const status = recordStatus(record, now);
  if (status === 'planned' || status === 'scheduled') return 0;
  if (status === 'active') return missionDay(record.start, now);
  const end = record.finishedAt ? new Date(record.finishedAt) : now;
  return Math.max(1, Math.min(missionDay(record.start, end), record.durationDays));
}

export function missionFromRecord(record: MissionRecord, current: Mission, now: Date): Mission {
  return {
    ...current,
    code: record.code,
    name: record.name,
    status: recordStatus(record, now),
    start: record.start,
    environment: record.environment,
    day: recordDay(record, now),
    currentDelayMin: record.currentDelayMin,
    crew: record.crew ? missionCrew(record.crew) : current.crew,
    phases: record.phases,
  };
}

export function toApiBody(record: MissionRecord, crew: Mission['crew']) {
  return {
    code: record.code,
    name: record.name,
    environment: record.environment,
    start: record.start,
    durationDays: record.durationDays,
    currentDelayMin: record.currentDelayMin,
    crew,
  };
}

const STATUSES: MissionStatus[] = ['planned', 'scheduled', 'active', 'finished'];
const isStatus = (value: unknown): value is MissionStatus =>
  STATUSES.includes(value as MissionStatus);

function phasesFromApi(value: unknown): MissionPhase[] | undefined {
  if (!Array.isArray(value) || value.length === 0) return undefined;
  const phases = value.flatMap((p) =>
    p && typeof p === 'object' && typeof p.environment === 'string' && Number.isInteger(p.days)
      ? [{ environment: p.environment as string, days: Math.max(1, p.days as number) }]
      : [],
  );
  return phases.length === value.length ? phases : undefined;
}

export function recordFromApi(value: unknown): MissionRecord | undefined {
  if (!value || typeof value !== 'object') return undefined;
  const m = value as Record<string, unknown>;
  const code = typeof m.code === 'string' ? normalizeMissionCode(m.code) : '';
  if (!isValidMissionCode(code) || typeof m.environment !== 'string') return undefined;
  const start =
    typeof m.start === 'string' && parseIsoDate(m.start.slice(0, 10))
      ? m.start.slice(0, 10)
      : undefined;
  const day = typeof m.day === 'number' ? m.day : 1;
  return {
    code,
    name: typeof m.name === 'string' && m.name ? m.name : code,
    environment: m.environment,
    start: start ?? startForDay(day, new Date()),
    durationDays: typeof m.durationDays === 'number' ? m.durationDays : 540,
    currentDelayMin:
      typeof m.currentDelayMin === 'number'
        ? m.currentDelayMin
        : typeof m.delayMin === 'number'
          ? m.delayMin
          : 0,
    createdAt: typeof m.createdAt === 'string' ? m.createdAt : new Date().toISOString(),
    origin: 'earth',
    crew: crewFromApi(m.crew),
    ...(isStatus(m.status) ? { status: m.status } : {}),
    ...(m.awaitingStart === true ? { awaitingStart: true as const } : {}),
    ...(typeof m.finishedAt === 'string' ? { finishedAt: m.finishedAt } : {}),
    ...(phasesFromApi(m.phases) ? { phases: phasesFromApi(m.phases) } : {}),
    ...(typeof m.start === 'string' && m.start.length > 10 && Date.parse(m.start)
      ? { startAt: m.start }
      : {}),
  };
}

export function findInApiResponse(response: unknown, code: string): MissionRecord | undefined {
  const list =
    response &&
    typeof response === 'object' &&
    Array.isArray((response as { missions?: unknown }).missions)
      ? (response as { missions: unknown[] }).missions
      : Array.isArray(response)
        ? response
        : [];
  for (const item of list) {
    const record = recordFromApi(item);
    if (record?.code === code) return record;
  }
  return undefined;
}

export type EarthLookup =
  | { status: 'found'; record: MissionRecord }
  | { status: 'missing' }
  | { status: 'unreachable' };

export type JoinDecision =
  | { from: 'earth' | 'local'; record: MissionRecord }
  | { from: 'offline' }
  | { from: 'unknown' };

export function decideJoin(local: MissionRecord | undefined, lookup: EarthLookup): JoinDecision {
  if (lookup.status === 'found') {
    return {
      from: 'earth',
      record: { ...lookup.record, crew: mergeCrew(lookup.record.crew ?? [], local?.crew) },
    };
  }
  if (local) return { from: 'local', record: local };
  return lookup.status === 'missing' ? { from: 'unknown' } : { from: 'offline' };
}
