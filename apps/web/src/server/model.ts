// T01 backend · Data model and pure computations of the Earth API.
// No 'server-only' and no MongoDB: used by server queries and by scripts/seed.ts.
// Earth never evaluates: it only aggregates the `assessments` each packet already carries.

import {
  type Assessment,
  type Config,
  evaluateZones,
  type Level,
  loadConfig,
  missionDays,
  type Packet,
  phaseAt,
  phaseDelay,
} from '@haven/core';
import type {
  CrewCard,
  CurrentPhase,
  DeliveryStatus,
  MissionHeader,
  MissionStatus,
  MissionSummary,
  ReceivedPacket,
  RulesVersion,
  StoredMission,
} from './types';
import { NO_RECENT_DATA_MS } from './types';

export const COLLECTIONS = {
  packets: 'packets',
  missions: 'missions',
  rules: 'rules',
} as const;

/** Document stored in `packets`: the phone's Packet plus receive metadata. */
export type PacketDoc = Packet & {
  receivedAt: string;
  dataAt: string;
};
export type MissionDoc = StoredMission;
export type RulesDoc = Omit<RulesVersion, 'status'>;

/** Indexes per collection (created by collections.ts on first use and by scripts/seed.ts). */
export const INDEXES: Record<
  keyof typeof COLLECTIONS,
  { key: Record<string, 1 | -1>; unique?: boolean }[]
> = {
  packets: [{ key: { id: 1 }, unique: true }, { key: { mission: 1, crewMember: 1, dataAt: -1 } }],
  missions: [{ key: { code: 1 }, unique: true }],
  rules: [{ key: { id: 1 }, unique: true }, { key: { mission: 1, sentAt: -1 } }],
};

const DAY_MS = 24 * 60 * 60 * 1000;
const LEVEL_RANK: Record<Level, number> = { red: 0, amber: 1, pending: 2, green: 3 };

let cachedConfig: Config | undefined;
export function baseConfig(): Config {
  cachedConfig ??= loadConfig();
  return cachedConfig;
}

// ─── Validation ────────────────────────────────────────────────────────────────

const isText = (v: unknown): v is string => typeof v === 'string' && v.length > 0;
const isDate = (v: unknown): v is string => isText(v) && !Number.isNaN(Date.parse(v));
const isObject = (v: unknown): v is Record<string, unknown> =>
  typeof v === 'object' && v !== null && !Array.isArray(v);

/** Checks the minimal shape of a Packet (shared contracts §6). */
export function validatePacket(
  body: unknown,
): { ok: true; packet: Packet } | { ok: false; errors: string[] } {
  if (!isObject(body)) return { ok: false, errors: ['body must be a JSON object'] };
  const errors: string[] = [];
  if (!isText(body.id) || body.id.length > 200) errors.push('id: required string');
  if (body.type !== 'routine' && body.type !== 'emergency')
    errors.push("type: 'routine' | 'emergency'");
  if (!isText(body.crewMember)) errors.push('crewMember: required string');
  if (!isText(body.mission) || body.mission.length > 32) errors.push('mission: required code');
  if (!Array.isArray(body.assessments)) errors.push('assessments: required array');
  else if (!body.assessments.every((a) => isObject(a) && isText(a.indicator) && isText(a.level)))
    errors.push('assessments: each one needs indicator and level');
  if (!Array.isArray(body.readings)) errors.push('readings: required array');
  if (body.notes !== undefined && typeof body.notes !== 'string') errors.push('notes: string');
  if (body.sentAt !== undefined && !isDate(body.sentAt)) errors.push('sentAt: ISO date');
  if (body.visibleAt !== undefined && !isDate(body.visibleAt)) errors.push('visibleAt: ISO date');
  if (body.createdAt !== undefined && !isDate(body.createdAt)) errors.push('createdAt: ISO date');
  if (body.dailyProgress !== undefined && !Array.isArray(body.dailyProgress))
    errors.push('dailyProgress: array');
  if (errors.length) return { ok: false, errors };
  // `sentAt` and `visibleAt` from the phone are optional: the server sets `visibleAt` on receipt.
  const sentAt = (body.sentAt as string | undefined) ?? new Date().toISOString();
  const packet = {
    ...body,
    notes: (body.notes as string | undefined) ?? '',
    createdAt: (body.createdAt as string | undefined) ?? sentAt,
    sentAt,
    visibleAt: (body.visibleAt as string | undefined) ?? sentAt,
  } as Packet;
  return { ok: true, packet };
}

// ─── Receiving ─────────────────────────────────────────────────────────────────

/** Time of the data in the packet: its newest reading (`takenAt`), or `createdAt` when it has no
 * readings. Never later than the receive time. The age shown on Earth is `now − dataAt`. */
export function computeDataAt(packet: Packet, receivedAt: Date): string {
  const times = packet.readings.map((r) => Date.parse(r.takenAt)).filter((t) => !Number.isNaN(t));
  const latest = times.length ? Math.max(...times) : Date.parse(packet.createdAt);
  return new Date(Math.min(latest, receivedAt.getTime())).toISOString();
}

/** Stored packet. Nothing is held back: `visibleAt` = receive time, so it is visible at once. */
export function packetDoc(packet: Packet, receivedAt: Date): PacketDoc {
  const { _id: _ignored, ...clean } = packet as Packet & { _id?: unknown };
  return {
    ...(clean as Packet),
    visibleAt: receivedAt.toISOString(),
    receivedAt: receivedAt.toISOString(),
    dataAt: computeDataAt(packet, receivedAt),
  };
}

/** Mission created when the first packet of an unknown code arrives. */
export function missionFromPacket(packet: Packet, receivedAt: Date): MissionDoc {
  return {
    code: packet.mission,
    name: packet.mission,
    environment: 'transit',
    day: 1,
    currentDelayMin: 0,
    linkDown: false,
    crew: [{ id: packet.crewMember, name: packet.crewMember, hasWatch: false }],
    start: receivedAt.toISOString(),
    durationDays: 0,
    createdAt: receivedAt.toISOString(),
    origin: 'packet',
  };
}

// ─── Packets for the API ───────────────────────────────────────────────────────

/** Turns a document into a ReceivedPacket: the phone's packet as sent, notes and diary included (everything
 * the astronaut chose to send is visible on Earth). */
export function packetForApi(doc: PacketDoc): ReceivedPacket {
  const { _id: _i, ...p } = doc as PacketDoc & { _id?: unknown; phoneVisibleAt?: string };
  delete (p as { phoneVisibleAt?: string }).phoneVisibleAt;
  return p;
}

// ─── Aggregation (visible packets only) ────────────────────────────────────────

/** Day of the mission (day 1 = `start`); 0 before `start`. */
export function missionDay(start: string, now: Date): number {
  const day = Math.floor((now.getTime() - Date.parse(start)) / DAY_MS) + 1;
  return day < 1 ? 0 : day;
}

/**
 * `planned` until «Start mission», `scheduled` before a future start date, `finished` once finished by hand or
 * past the last day of its plan, `active` otherwise.
 */
export function missionStatus(
  m: Pick<MissionDoc, 'awaitingStart' | 'start' | 'finishedAt' | 'durationDays'>,
  now: Date,
): MissionStatus {
  if (m.finishedAt) return 'finished';
  if (m.awaitingStart) return 'planned';
  if (Date.parse(m.start) > now.getTime()) return 'scheduled';
  return m.durationDays > 0 && missionDay(m.start, now) > m.durationDays ? 'finished' : 'active';
}

/** Last day of a finished mission: the day it was finished on, never past the end of its plan. */
function finalDay(m: Pick<MissionDoc, 'start' | 'finishedAt' | 'durationDays'>, now: Date): number {
  const day = Math.max(1, missionDay(m.start, m.finishedAt ? new Date(m.finishedAt) : now));
  return m.durationDays > 0 ? Math.min(day, m.durationDays) : day;
}

export function missionForApi(doc: MissionDoc, now: Date): StoredMission {
  const { _id: _i, ...stored } = doc as MissionDoc & { _id?: unknown };
  const status = missionStatus(stored, now);
  const m = { ...stored, status };
  // Days only run once the mission has started; before that it sits at day 0, in its first phase. A finished
  // mission stays on its last day.
  const day =
    status === 'active' ? missionDay(m.start, now) : status === 'finished' ? finalDay(m, now) : 0;
  const current = m.phases?.length ? phaseAt(m.phases, Math.max(1, day)) : undefined;
  if (!current || !m.phases) return { ...m, day };
  if (status === 'planned' || status === 'scheduled') {
    const first = baseConfig().environments.find((e) => e.id === current.phase.environment);
    return {
      ...m,
      day,
      environment: current.phase.environment,
      currentDelayMin: phaseDelay(current.phase, first),
      durationDays: missionDays(m.phases),
    };
  }
  // A phased mission takes today's environment and delay from its plan.
  const environment = baseConfig().environments.find((e) => e.id === current.phase.environment);
  return {
    ...m,
    day,
    environment: current.phase.environment,
    currentDelayMin: phaseDelay(current.phase, environment),
    durationDays: missionDays(m.phases),
  };
}

/** Today's phase of a phased mission (header «Phase 3 of 8 · Cruise to Mars»). */
export function currentPhase(mission: StoredMission): CurrentPhase | undefined {
  const phases = mission.phases;
  const current = phases?.length ? phaseAt(phases, mission.day) : undefined;
  if (!phases || !current) return undefined;
  return {
    index: current.index,
    total: phases.length,
    startDay: current.startDay,
    endDay: current.endDay,
    ...(current.phase.label ? { label: current.phase.label } : {}),
  };
}

export function missionHeader(mission: StoredMission, cards: CrewCard[]): MissionHeader {
  const latest = cards
    .map((c) => c.lastDataAt)
    .filter((v): v is string => v !== null)
    .sort()
    .at(-1);
  return {
    code: mission.code,
    name: mission.name,
    environment: mission.environment,
    day: mission.day,
    status: mission.status ?? 'active',
    start: mission.start,
    delayMin: mission.currentDelayMin,
    linkDown: mission.linkDown,
    lastDataAt: latest ?? null,
    ...(currentPhase(mission) ? { phase: currentPhase(mission) } : {}),
  };
}

/** A crew entry as stored in `missions.crew`; `role` is data (written by the seed or a mission editor). */
export type CrewEntry = StoredMission['crew'][number];

const byDataAtDesc = (a: { dataAt: string }, b: { dataAt: string }) =>
  b.dataAt.localeCompare(a.dataAt);

/**
 * Current assessments of one crew member: those of their newest packet with assessments, where every
 * indicator that packet left `pending` (an emergency packet only measures a few) keeps the last known level
 * from an older packet whose data is at most `NO_RECENT_DATA_MS` older. A short packet never hides a red.
 */
export function currentAssessments(
  packets: Pick<PacketDoc, 'assessments' | 'dataAt'>[],
): Assessment[] {
  const sorted = packets.filter((p) => p.assessments.length > 0).sort(byDataAtDesc);
  const newest = sorted[0];
  if (!newest) return [];
  const since = Date.parse(newest.dataAt) - NO_RECENT_DATA_MS;
  const older = sorted.slice(1).filter((p) => Date.parse(p.dataAt) >= since);
  const known = (indicator: string) =>
    older
      .map((p) => p.assessments.find((a) => a.indicator === indicator && a.level !== 'pending'))
      .find(Boolean);
  const merged = newest.assessments.map((a) =>
    a.level === 'pending' ? (known(a.indicator) ?? a) : a,
  );
  const present = new Set(merged.map((a) => a.indicator));
  for (const p of older)
    for (const a of p.assessments)
      if (!present.has(a.indicator) && a.level !== 'pending') {
        merged.push(a);
        present.add(a.indicator);
      }
  return merged;
}

/** Card of one crew member built from their received packets. */
export function crewCard(
  member: CrewEntry,
  visible: Pick<
    PacketDoc,
    'id' | 'type' | 'assessments' | 'dailyProgress' | 'dataAt' | 'visibleAt'
  >[],
  now: Date,
  config: Config = baseConfig(),
): CrewCard {
  const sorted = [...visible].sort(byDataAtDesc);
  const latest = sorted[0];
  const assessments = currentAssessments(sorted);
  const withProgress = sorted.find((p) => Array.isArray(p.dailyProgress));

  const zones = assessments.length
    ? evaluateZones(assessments, config).map(({ zone, level }) => ({ zone, level }))
    : config.zones.map((z) => ({ zone: z.id, level: 'pending' as const }));

  const alerts = assessments
    .filter((a: Assessment) => a.level === 'red' || a.level === 'amber')
    .sort((a, b) => LEVEL_RANK[a.level] - LEVEL_RANK[b.level]);

  const dailyProgress = withProgress?.dailyProgress ?? null;
  const role = member.role;

  return {
    id: member.id,
    name: member.name,
    hasWatch: member.hasWatch,
    ...(role ? { role } : {}),
    lastDataAt: latest?.dataAt ?? null,
    lastVisibleAt: latest?.visibleAt ?? null,
    noRecentData: !latest || now.getTime() - Date.parse(latest.dataAt) > NO_RECENT_DATA_MS,
    dailyProgress,
    dailyProgressAt: withProgress?.dataAt ?? null,
    actionsDone: (dailyProgress ?? []).filter((z) => z.progress >= 1).length,
    actionsTotal: config.zones.length || dailyProgress?.length || 7,
    zones,
    alerts,
    lastPacket: latest ? { id: latest.id, type: latest.type, visibleAt: latest.visibleAt } : null,
  };
}

export function missionSummary(cards: CrewCard[], mission: StoredMission): MissionSummary {
  const zones = cards.flatMap((c) => c.zones);
  return {
    actionsDone: cards.reduce((s, c) => s + c.actionsDone, 0),
    actionsTotal: cards.reduce((s, c) => s + c.actionsTotal, 0),
    amberZones: zones.filter((z) => z.level === 'amber').length,
    redZones: zones.filter((z) => z.level === 'red').length,
    delayMin: mission.currentDelayMin,
  };
}

/** Crew id from a display name, as the phone will send it: «Ana Ruíz» → `ana-ruiz`, unique among `taken`. */
export function crewIdFor(name: string, taken: string[]): string {
  const base =
    name
      .normalize('NFD')
      .replace(/[̀-ͯ]/g, '')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 40) || 'crew';
  let id = base;
  for (let n = 2; taken.includes(id); n++) id = `${base}-${n}`;
  return id;
}

/** Crew members: those of the mission plus anyone who has sent packets. */
export function crewMembers(mission: StoredMission, ids: string[]): CrewEntry[] {
  const list = [...mission.crew];
  for (const id of ids) {
    if (!list.some((m) => m.id === id)) list.push({ id, name: id, hasWatch: false });
  }
  return list;
}

/** Numeric `[t, value]` series per indicator, de-duplicated by reading id. */
export function seriesOf(packets: ReceivedPacket[]): Record<string, [number, number][]> {
  const seen = new Set<string>();
  const series: Record<string, [number, number][]> = {};
  for (const p of packets) {
    for (const r of p.readings) {
      if (seen.has(r.id)) continue;
      seen.add(r.id);
      const value = typeof r.value === 'number' ? r.value : Number(r.value);
      const t = Date.parse(r.takenAt);
      if (typeof r.value === 'string' && r.value.trim() === '') continue;
      if (!Number.isFinite(value) || Number.isNaN(t)) continue;
      series[r.indicator] ??= [];
      series[r.indicator].push([t, value]);
    }
  }
  for (const s of Object.values(series)) s.sort((a, b) => a[0] - b[0]);
  return series;
}

// ─── Missions and rules ────────────────────────────────────────────────────────

const CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // no 0/O or 1/I

export function generateCode(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(6));
  return Array.from(bytes, (b) => CODE_ALPHABET[b % CODE_ALPHABET.length]).join('');
}

/** sent: created on Earth · received: a phone downloaded it (GET /api/rules) · applied: a phone applied it. */
export function deliveryStatus(doc: RulesDoc): DeliveryStatus {
  if (doc.appliedAt) return 'applied';
  return doc.receivedAt ? 'received' : 'sent';
}

export function rulesForApi(doc: RulesDoc): RulesVersion {
  const {
    _id: _i,
    visibleAt: _v,
    demoFactor: _f,
    ...r
  } = doc as RulesDoc & {
    _id?: unknown;
    visibleAt?: string;
    demoFactor?: number;
  };
  // Older documents may lack the download fields or still carry visibleAt/demoFactor (dropped above).
  const out: RulesDoc = { ...r, receivedAt: r.receivedAt ?? null, receivedBy: r.receivedBy ?? [] };
  return { ...out, status: deliveryStatus(out) };
}
