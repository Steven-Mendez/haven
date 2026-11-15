import 'server-only';
import {
  type CrewPlan,
  classifySample,
  cleanAssignments,
  cleanPrescription,
  crewAggregates,
  emptyPlan,
  exercise as exerciseConfig,
  type Mission,
  type MissionPhase,
  medications as medicationConfig,
  missionDays,
  parseCollection,
  type Reading,
  type SampleLevel,
  type SampleResult,
  collections as sampleCollections,
  sampleConfig,
} from '@haven/core';
import { type KpiDashboard, type KpiSeriesData, validateDashboard } from '@/lib/kpi';
import { CREW_NOT_READY } from '@/server/types';
import { dashboards, missions, packets, plans, rules, sampleResults } from './collections';
import {
  baseConfig,
  type CrewEntry,
  crewCard,
  crewIdFor,
  crewMembers,
  currentAssessments,
  generateCode,
  latestEmergencyVersions,
  type MissionDoc,
  missionForApi,
  missionHeader,
  missionStatus,
  missionSummary,
  type PacketDoc,
  packetDoc,
  packetForApi,
  type RulesDoc,
  rulesForApi,
  seriesOf,
  validatePacket,
} from './model';
import type {
  AggregatesResponse,
  AstronautResponse,
  CrewResponse,
  MissionsResponse,
  PacketReceipt,
  RulesResponse,
  RulesVersion,
  StoredMission,
} from './types';

export type Result<T> =
  | { ok: true; status: number; data: T }
  | { ok: false; status: number; error: string; details?: string[] };

const fail = (status: number, error: string, details?: string[]) =>
  ({ ok: false, status, error, details }) as const;

const NO_ID = { projection: { _id: 0 } } as const;
const DUPLICATE_KEY = 11000;
const isDuplicateKey = (error: unknown) => (error as { code?: number }).code === DUPLICATE_KEY;

export async function receivePacket(
  body: unknown,
  now = new Date(),
): Promise<Result<PacketReceipt>> {
  const checked = validatePacket(body);
  if (!checked.ok) return fail(400, 'Invalid packet', checked.errors);
  const { currentMission, ...packet } = checked.packet as typeof checked.packet & {
    currentMission?: Partial<Mission>;
  };

  const col = await packets();
  const existing = await col.findOne({ id: packet.id }, NO_ID);
  if (existing) return duplicate(existing);
  if (!(await (await missions()).countDocuments({ code: packet.mission }, { limit: 1 })))
    return fail(404, `Mission ${packet.mission} does not exist`);

  const doc = packetDoc(packet, now);
  try {
    await col.insertOne({ ...doc });
  } catch (error) {
    if (isDuplicateKey(error)) {
      const other = await col.findOne({ id: packet.id }, NO_ID);
      if (other) return duplicate(other);
    }
    throw error;
  }
  await registerMission(doc, currentMission);
  return {
    ok: true,
    status: 201,
    data: { id: doc.id, receivedAt: doc.receivedAt, visibleAt: doc.visibleAt },
  };
}

function duplicate(doc: PacketDoc): Result<PacketReceipt> {
  return {
    ok: true,
    status: 200,
    data: { id: doc.id, receivedAt: doc.receivedAt, visibleAt: doc.visibleAt, duplicate: true },
  };
}

async function registerMission(packet: PacketDoc, currentMission: Partial<Mission> | undefined) {
  const col = await missions();
  const set: Partial<Pick<MissionDoc, 'environment' | 'currentDelayMin'>> = {};
  if (typeof currentMission === 'object' && currentMission !== null) {
    if (typeof currentMission.environment === 'string')
      set.environment = currentMission.environment;
    if (typeof currentMission.currentDelayMin === 'number')
      set.currentDelayMin = currentMission.currentDelayMin;
  }
  if (Object.keys(set).length) await col.updateOne({ code: packet.mission }, { $set: set });
  await col.updateOne(
    { code: packet.mission, 'crew.id': { $ne: packet.crewMember } },
    { $push: { crew: { id: packet.crewMember, name: packet.crewMember, hasWatch: false } } },
  );
  if (packet.readings.some((r) => r.source === 'watch'))
    await col.updateOne(
      {
        code: packet.mission,
        crew: { $elemMatch: { id: packet.crewMember, hasWatch: { $ne: true } } },
      },
      { $set: { 'crew.$.hasWatch': true } },
    );
}

async function findMission(code: string, now: Date): Promise<StoredMission | null> {
  const doc = await (await missions()).findOne({ code }, NO_ID);
  return doc ? missionForApi(doc, now) : null;
}

export async function getCrew(code: string, now = new Date()): Promise<CrewResponse | null> {
  const mission = await findMission(code, now);
  if (!mission) return null;
  const visible = await (await packets())
    .find({ mission: code }, { projection: { _id: 0, readings: 0, notes: 0, photos: 0, ecg: 0 } })
    .toArray();
  const ids = [...new Set(visible.map((p) => p.crewMember))];
  const config = baseConfig();
  const cards = crewMembers(mission, ids).map((m) =>
    crewCard(
      m,
      visible.filter((p) => p.crewMember === m.id),
      now,
      config,
    ),
  );
  return {
    generatedAt: now.toISOString(),
    mission: missionHeader(mission, cards),
    summary: missionSummary(
      cards.filter((c) => c.lastPacket !== null),
      mission,
    ),
    crew: cards,
  };
}

export async function getAstronaut(
  code: string,
  crewMember: string,
  now = new Date(),
): Promise<AstronautResponse | null> {
  const mission = await findMission(code, now);
  if (!mission) return null;
  const visible = await (await packets())
    .find({ mission: code, crewMember }, NO_ID)
    .sort({ dataAt: -1 })
    .toArray();
  const member = crewMembers(mission, visible.length ? [crewMember] : []).find(
    (m) => m.id === crewMember,
  );
  if (!member) return null;

  const card = crewCard(member, visible, now);
  const list = latestEmergencyVersions(visible).map(packetForApi);

  return {
    generatedAt: now.toISOString(),
    mission: missionHeader(mission, [card]),
    crewMember: card,
    assessments: currentAssessments(visible),
    series: seriesOf(list),
    packets: list,
  };
}

export async function listMissions(now = new Date()): Promise<MissionsResponse> {
  const docs = await (await missions()).find({}, NO_ID).sort({ createdAt: -1 }).toArray();
  return { missions: docs.map((d) => missionForApi(d, now)) };
}

export async function getMission(code: string, now = new Date()) {
  return findMission(code, now);
}

export async function startMission(code: string, now = new Date()): Promise<Result<StoredMission>> {
  const col = await missions();
  const mission = await col.findOne({ code }, NO_ID);
  if (!mission) return fail(404, `Mission ${code} does not exist`);
  const status = missionStatus(mission, now);
  if (status === 'active' || status === 'finished') return fail(409, 'Mission already started');
  const sending = await (await packets()).distinct('crewMember', { mission: code });
  const waiting = mission.crew.filter((m) => !m.joinedAt && !sending.includes(m.id));
  if (mission.crew.length === 0 || waiting.length > 0)
    return fail(
      409,
      CREW_NOT_READY,
      waiting.map((m) => m.id),
    );
  const today = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  await col.updateOne(
    { code },
    { $set: { start: today.toISOString() }, $unset: { awaitingStart: '' } },
  );
  const updated = await col.findOne({ code }, NO_ID);
  return { ok: true, status: 200, data: missionForApi(updated ?? mission, now) };
}

export async function finishMission(
  code: string,
  now = new Date(),
): Promise<Result<StoredMission>> {
  const col = await missions();
  const mission = await col.findOne({ code }, NO_ID);
  if (!mission) return fail(404, `Mission ${code} does not exist`);
  if (missionStatus(mission, now) !== 'active')
    return fail(409, 'Only a running mission can be finished');
  await col.updateOne({ code }, { $set: { finishedAt: now.toISOString() } });
  const updated = await col.findOne({ code }, NO_ID);
  return { ok: true, status: 200, data: missionForApi(updated ?? mission, now) };
}

export type MissionEdit = {
  name?: string;
  phases?: MissionPhase[];
  start?: string;
  awaitingStart?: boolean;
};

export async function updateMission(
  code: string,
  edit: MissionEdit,
  now = new Date(),
): Promise<Result<StoredMission>> {
  const col = await missions();
  const mission = await col.findOne({ code }, NO_ID);
  if (!mission) return fail(404, `Mission ${code} does not exist`);
  const status = missionStatus(mission, now);
  if (status === 'finished') return fail(409, 'A finished mission is a record');
  const preparing = status === 'planned' || status === 'scheduled';
  if (!preparing && (edit.phases || edit.start || edit.awaitingStart !== undefined))
    return fail(409, 'The plan and start can only change while the mission is in preparation');

  const set: Partial<MissionDoc> = {};
  if (edit.name?.trim()) set.name = edit.name.trim().slice(0, 80);
  if (edit.phases?.length) {
    const first = baseConfig().environments.find((e) => e.id === edit.phases?.[0]?.environment);
    set.phases = edit.phases;
    set.durationDays = missionDays(edit.phases);
    set.environment = edit.phases[0].environment;
    set.currentDelayMin = first?.delayMin ?? mission.currentDelayMin;
  }
  if (edit.start) set.start = edit.start;
  const update: Record<string, unknown> = { $set: set };
  if (edit.awaitingStart === true) set.awaitingStart = true;
  if (edit.awaitingStart === false) update.$unset = { awaitingStart: '' };
  await col.updateOne({ code }, update);
  const updated = await col.findOne({ code }, NO_ID);
  return { ok: true, status: 200, data: missionForApi(updated ?? mission, now) };
}

async function editableMission(code: string, now = new Date()) {
  const mission = await (await missions()).findOne({ code }, NO_ID);
  if (!mission) return fail(404, `Mission ${code} does not exist`);
  if (missionStatus(mission, now) === 'finished')
    return fail(409, 'A finished mission is a record');
  return null;
}

export type SessionEvent = 'join' | 'leave';

export async function recordCrewSession(
  body: unknown,
  now = new Date(),
): Promise<Result<{ mission: string; crewMember: string; joinedAt: string | null }>> {
  const b = (typeof body === 'object' && body !== null ? body : {}) as Record<string, unknown>;
  const code = typeof b.mission === 'string' ? b.mission.trim().toUpperCase() : '';
  const id = typeof b.crewMember === 'string' ? b.crewMember.trim() : '';
  const event = b.event === 'leave' ? 'leave' : b.event === 'join' ? 'join' : undefined;
  const errors: string[] = [];
  if (!code || code.length > 32) errors.push('mission: required code');
  if (!id || id.length > 60) errors.push('crewMember: required id');
  if (!event) errors.push("event: 'join' | 'leave'");
  if (errors.length) return fail(400, 'Invalid session event', errors);

  const col = await missions();
  const mission = await col.findOne({ code }, NO_ID);
  if (!mission) return fail(404, `Mission ${code} does not exist`);
  const member = mission.crew.find((m) => m.id === id);
  const data = (joinedAt: string | null) => ({
    ok: true as const,
    status: 200,
    data: { mission: code, crewMember: id, joinedAt },
  });

  if (event === 'leave') {
    await col.updateOne({ code, 'crew.id': id }, { $unset: { 'crew.$.joinedAt': '' } });
    return data(null);
  }
  if (member?.joinedAt) return data(member.joinedAt);
  const joinedAt = now.toISOString();
  if (member) {
    await col.updateOne({ code, 'crew.id': id }, { $set: { 'crew.$.joinedAt': joinedAt } });
  } else {
    const name = typeof b.name === 'string' && b.name.trim() ? b.name.trim().slice(0, 60) : id;
    await col.updateOne(
      { code, 'crew.id': { $ne: id } },
      { $push: { crew: { id, name, hasWatch: false, joinedAt } } },
    );
  }
  return data(joinedAt);
}

export type CrewInput = { name: string; role?: string };

const roleOf = (role?: string) => (role ? { role: { es: role, en: role } } : {});

export async function addCrewMember(code: string, input: CrewInput): Promise<Result<CrewEntry>> {
  const locked = await editableMission(code);
  if (locked) return locked;
  const col = await missions();
  const mission = await col.findOne({ code }, NO_ID);
  if (!mission) return fail(404, `Mission ${code} does not exist`);
  const entry: CrewEntry = {
    id: crewIdFor(
      input.name,
      mission.crew.map((m) => m.id),
    ),
    name: input.name,
    hasWatch: false,
    ...roleOf(input.role),
  };
  await col.updateOne({ code }, { $push: { crew: entry } });
  return { ok: true, status: 201, data: entry };
}

export async function updateCrewMember(
  code: string,
  id: string,
  input: CrewInput,
): Promise<Result<CrewEntry>> {
  const locked = await editableMission(code);
  if (locked) return locked;
  const col = await missions();
  const mission = await col.findOne({ code, 'crew.id': id }, NO_ID);
  const current = mission?.crew.find((m) => m.id === id);
  if (!current) return fail(404, `Crew member ${id} is not in mission ${code}`);
  const entry: CrewEntry = {
    id: current.id,
    name: input.name,
    hasWatch: current.hasWatch,
    ...roleOf(input.role),
    ...(current.joinedAt ? { joinedAt: current.joinedAt } : {}),
  };
  await col.updateOne({ code, 'crew.id': id }, { $set: { 'crew.$': entry } });
  return { ok: true, status: 200, data: entry };
}

export async function removeCrewMember(
  code: string,
  id: string,
): Promise<Result<{ id: string; packets: number }>> {
  const locked = await editableMission(code);
  if (locked) return locked;
  const result = await (await missions()).updateOne({ code }, { $pull: { crew: { id } } });
  if (!result.matchedCount) return fail(404, `Mission ${code} does not exist`);
  const removed = await (await packets()).deleteMany({ mission: code, crewMember: id });
  return { ok: true, status: 200, data: { id, packets: removed.deletedCount } };
}

const FALLBACK_ENVIRONMENTS = ['transit', 'station', 'moon', 'mars', 'rover'];

const MAX_MISSION_DAYS = 3000;

function parsePhases(value: unknown, environments: string[], errors: string[]) {
  if (!Array.isArray(value) || value.length === 0) {
    errors.push('phases: non-empty array');
    return undefined;
  }
  const phases: MissionPhase[] = [];
  value.forEach((raw, i) => {
    const p = (typeof raw === 'object' && raw !== null ? raw : {}) as Record<string, unknown>;
    if (typeof p.environment !== 'string' || !environments.includes(p.environment))
      errors.push(`phases[${i}].environment: one of ${environments.join(', ')}`);
    if (
      typeof p.days !== 'number' ||
      !Number.isInteger(p.days) ||
      p.days < 1 ||
      p.days > MAX_MISSION_DAYS
    )
      errors.push(`phases[${i}].days: whole number 1–${MAX_MISSION_DAYS}`);
    if (p.delayMin !== undefined && typeof p.delayMin !== 'number')
      errors.push(`phases[${i}].delayMin: number`);
    const label = p.label as Record<string, unknown> | undefined;
    if (label !== undefined && (typeof label?.es !== 'string' || typeof label?.en !== 'string'))
      errors.push(`phases[${i}].label: { es, en }`);
    phases.push({
      environment: p.environment as string,
      days: p.days as number,
      ...(typeof p.delayMin === 'number' ? { delayMin: p.delayMin } : {}),
      ...(label ? { label: { es: String(label.es), en: String(label.en) } } : {}),
    });
  });
  if (missionDays(phases) > MAX_MISSION_DAYS)
    errors.push(`phases: at most ${MAX_MISSION_DAYS} days`);
  return phases;
}

export async function createMission(
  body: unknown,
  now = new Date(),
): Promise<Result<StoredMission>> {
  const b = (typeof body === 'object' && body !== null ? body : {}) as Record<string, unknown>;
  const config = baseConfig();
  const environments = config.environments.length
    ? config.environments.map((e) => e.id)
    : FALLBACK_ENVIRONMENTS;
  const errors: string[] = [];
  if (typeof b.name !== 'string' || !b.name.trim()) errors.push('name: required string');
  const phases = b.phases !== undefined ? parsePhases(b.phases, environments, errors) : undefined;
  if (!phases) {
    if (typeof b.environment !== 'string' || !environments.includes(b.environment))
      errors.push(`environment: one of ${environments.join(', ')}`);
    if (typeof b.durationDays !== 'number' || b.durationDays <= 0)
      errors.push('durationDays: number > 0');
  }
  if (b.start !== undefined && (typeof b.start !== 'string' || Number.isNaN(Date.parse(b.start))))
    errors.push('start: ISO date');
  if (b.code !== undefined && (typeof b.code !== 'string' || !/^[A-Z0-9]{6}$/.test(b.code)))
    errors.push('code: six characters A-Z/0-9');
  if (b.currentDelayMin !== undefined && typeof b.currentDelayMin !== 'number')
    errors.push('currentDelayMin: number');
  if (b.crew !== undefined && !Array.isArray(b.crew)) errors.push('crew: array');
  if (b.awaitingStart !== undefined && typeof b.awaitingStart !== 'boolean')
    errors.push('awaitingStart: boolean');
  if (errors.length) return fail(400, 'Invalid mission', errors);

  const environmentId = phases?.[0]?.environment ?? (b.environment as string);
  const environment = config.environments.find((e) => e.id === environmentId);
  const col = await missions();
  for (let attempt = 0; attempt < 5; attempt++) {
    const doc: MissionDoc = {
      code: (b.code as string | undefined) ?? generateCode(),
      name: (b.name as string).trim(),
      environment: environmentId,
      day: 1,
      currentDelayMin: (b.currentDelayMin as number | undefined) ?? environment?.delayMin ?? 0,
      linkDown: false,
      crew: ((b.crew as Mission['crew'] | undefined) ?? []).filter(
        (m) => typeof m?.id === 'string',
      ),
      start: b.start ? new Date(b.start as string).toISOString() : now.toISOString(),
      durationDays: phases ? missionDays(phases) : (b.durationDays as number),
      createdAt: now.toISOString(),
      origin: 'earth',
      ...(b.awaitingStart === true ? { awaitingStart: true } : {}),
      ...(phases ? { phases } : {}),
    };
    try {
      await col.insertOne({ ...doc });
      return { ok: true, status: 201, data: missionForApi(doc, now) };
    } catch (error) {
      if (!isDuplicateKey(error)) throw error;
      if (b.code) return fail(409, 'A mission with that code already exists');
    }
  }
  return fail(500, 'Could not generate a unique code');
}

export async function listRules(
  code: string,
  options: { downloadedBy?: string } = {},
  now = new Date(),
): Promise<RulesResponse> {
  const col = await rules();
  const by = options.downloadedBy?.trim();
  const mission = by ? await findMission(code, now) : null;
  if (by && mission?.crew.some((m) => m.id === by)) {
    const at = now.toISOString();
    await col.updateMany({ mission: code, receivedAt: null }, { $set: { receivedAt: at } });
    await col.updateMany({ mission: code }, { $push: { receivedBy: { crewMember: by, at } } });
  }
  const docs = await col.find({ mission: code }, NO_ID).sort({ sentAt: -1 }).toArray();
  return { mission: code, versions: docs.map((d) => rulesForApi(d)) };
}

export async function saveRules(
  code: string,
  body: unknown,
  now = new Date(),
): Promise<Result<RulesVersion>> {
  const b = (typeof body === 'object' && body !== null ? body : {}) as Record<string, unknown>;
  const mission = await findMission(code, now);
  if (!mission) return fail(404, `Mission ${code} does not exist`);
  const col = await rules();

  if (typeof b.apply === 'string') {
    const doc = await col.findOne(
      { mission: code, $or: [{ id: b.apply }, { version: b.apply }] },
      { ...NO_ID, sort: { sentAt: -1 } },
    );
    if (!doc) return fail(404, `Version ${b.apply} does not exist`);
    const at =
      typeof b.appliedAt === 'string' && !Number.isNaN(Date.parse(b.appliedAt))
        ? new Date(b.appliedAt).toISOString()
        : now.toISOString();
    const crewMember = typeof b.crewMember === 'string' ? b.crewMember : 'phone';
    await col.updateOne(
      { id: doc.id },
      {
        $set: { appliedAt: doc.appliedAt ?? at, receivedAt: doc.receivedAt ?? at },
        $push: { appliedBy: { crewMember, at } },
      },
    );
    const updated = await col.findOne({ id: doc.id }, NO_ID);
    return { ok: true, status: 200, data: rulesForApi(updated as RulesDoc) };
  }

  if (typeof b.config !== 'object' || b.config === null || Array.isArray(b.config))
    return fail(400, 'Invalid rules', ['config: required object (or `apply`: id)']);
  const previous = await col.countDocuments({ mission: code });
  const config = b.config as Record<string, unknown>;
  const version =
    typeof b.version === 'string' && b.version.trim()
      ? b.version.trim()
      : typeof config.version === 'string'
        ? config.version
        : `${baseConfig().version}-earth.${previous + 1}`;
  const doc: RulesDoc = {
    id: crypto.randomUUID(),
    mission: code,
    version,
    note: typeof b.note === 'string' ? b.note : '',
    author: typeof b.author === 'string' ? b.author : 'mission-control',
    config,
    sentAt: now.toISOString(),
    receivedAt: null,
    receivedBy: [],
    appliedAt: null,
    appliedBy: [],
  };
  await col.insertOne({ ...doc });
  return { ok: true, status: 201, data: rulesForApi(doc) };
}

const READING_VALUES = {
  projection: {
    _id: 0,
    crewMember: 1,
    'readings.indicator': 1,
    'readings.value': 1,
    'readings.takenAt': 1,
  },
} as const;

async function readingsByCrewMember(code: string): Promise<Record<string, Reading[]>> {
  const visible = await (await packets()).find({ mission: code }, READING_VALUES).toArray();
  const byCrewMember: Record<string, Reading[]> = {};
  for (const p of visible) {
    byCrewMember[p.crewMember] ??= [];
    byCrewMember[p.crewMember].push(...(p.readings ?? []));
  }
  return byCrewMember;
}

export async function missionAggregates(
  code: string,
  indicators: string[],
): Promise<AggregatesResponse> {
  const byCrewMember = await readingsByCrewMember(code);
  return {
    mission: code,
    indicators: Object.fromEntries(
      indicators.map((i) => [i, crewAggregates(byCrewMember, i, { minimum: 1 })]),
    ),
  };
}

export async function getPlan(mission: string, crewMember: string): Promise<CrewPlan> {
  const doc = await (await plans()).findOne({ mission, crewMember }, NO_ID);
  return doc ?? emptyPlan(mission, crewMember);
}

export async function listPlans(mission: string): Promise<CrewPlan[]> {
  return (await plans()).find({ mission }, NO_ID).toArray();
}

export async function savePlan(
  mission: string,
  crewMember: string,
  medications: unknown,
  author?: string,
  now = new Date(),
): Promise<Result<CrewPlan>> {
  if (!(await findMission(mission, now))) return fail(404, `Mission ${mission} does not exist`);
  const plan: CrewPlan = {
    mission,
    crewMember,
    medications: cleanAssignments(medications, medicationConfig),
    updatedAt: now.toISOString(),
    ...(author ? { author: author.slice(0, 80) } : {}),
  };
  await (await plans()).updateOne({ mission, crewMember }, { $set: plan }, { upsert: true });
  return { ok: true, status: 200, data: plan };
}

export async function listSampleResults(mission: string): Promise<SampleResult[]> {
  return (await sampleResults()).find({ mission }, NO_ID).sort({ collectedAt: 1 }).toArray();
}

export type SampleResultInput = {
  id: string;
  /** Lab values by analyte id; unknown analytes are dropped. */
  values?: Record<string, number>;
  /** Earth's level when it overrides the one computed from the values. */
  override?: string;
  detail?: string;
  author?: string;
};

const LEVELS: SampleLevel[] = ['normal', 'abnormal', 'critical'];

/** Stores Earth's lab result for one collection reading that already arrived. */
export async function saveSampleResult(
  mission: string,
  input: SampleResultInput,
  now = new Date(),
): Promise<Result<SampleResult>> {
  const doc = await (await packets()).findOne(
    { mission, 'readings.id': input.id },
    { projection: { _id: 0, readings: 1 } },
  );
  const reading = doc ? sampleCollections(doc.readings).find((r) => r.id === input.id) : undefined;
  if (!reading) return fail(404, `Sample ${input.id} has not arrived`);
  const sample = sampleConfig.samples.find((s) => s.id === reading.value);
  if (!sample) return fail(400, `Unknown sample ${String(reading.value)}`);
  const values = Object.fromEntries(
    sample.analytes
      .map((a) => [a.id, input.values?.[a.id]] as const)
      .filter(
        (e): e is readonly [string, number] => typeof e[1] === 'number' && Number.isFinite(e[1]),
      ),
  );
  const { level: computed } = classifySample(sample, values);
  const override = LEVELS.find((l) => l === input.override);
  const result = override ?? computed;
  if (!result) return fail(400, 'Enter at least one value or choose a result');
  const { module } = parseCollection(reading);
  const doc2: SampleResult = {
    id: reading.id,
    mission,
    crewMember: reading.crewMember,
    sample: sample.id,
    collectedAt: reading.takenAt,
    ...(module ? { module } : {}),
    result,
    ...(Object.keys(values).length ? { values } : {}),
    ...(computed ? { computed } : {}),
    ...(override && override !== computed ? { overridden: true } : {}),
    ...(input.detail?.trim() ? { detail: input.detail.trim().slice(0, 280) } : {}),
    enteredAt: now.toISOString(),
    ...(input.author ? { author: input.author.slice(0, 80) } : {}),
  };
  await (await sampleResults()).replaceOne({ id: doc2.id }, doc2, { upsert: true });
  return { ok: true, status: 200, data: doc2 };
}

export async function missionKpiSeries(code: string, indicators: string[]): Promise<KpiSeriesData> {
  const byCrewMember = await readingsByCrewMember(code);
  return {
    mission: code,
    crew: Object.fromEntries(
      indicators.map((i) => [i, crewAggregates(byCrewMember, i, { minimum: 1 })]),
    ),
    members: Object.fromEntries(
      Object.entries(byCrewMember).map(([member, readings]) => [
        member,
        Object.fromEntries(
          indicators.flatMap((i) => {
            const points = crewAggregates({ [member]: readings }, i, { minimum: 1 }) ?? [];
            return points.length ? [[i, points]] : [];
          }),
        ),
      ]),
    ),
  };
}

const DASHBOARD_KEY = 'kpi';

export async function getDashboard(mission: string): Promise<KpiDashboard | null> {
  const doc = await (await dashboards()).findOne({ mission, key: DASHBOARD_KEY }, NO_ID);
  if (!doc) return null;
  const checked = validateDashboard(doc.dashboard);
  return checked.ok ? checked.dashboard : null;
}

export async function saveDashboard(
  mission: string,
  body: unknown,
  now = new Date(),
): Promise<Result<KpiDashboard>> {
  if (!(await findMission(mission, now))) return fail(404, `Mission ${mission} does not exist`);
  const checked = validateDashboard(body);
  if (!checked.ok) return fail(400, 'Invalid dashboard', checked.errors);
  await (await dashboards()).updateOne(
    { mission, key: DASHBOARD_KEY },
    { $set: { dashboard: checked.dashboard, updatedAt: now.toISOString() } },
    { upsert: true },
  );
  return { ok: true, status: 200, data: checked.dashboard };
}

/**
 * Sets or clears (with null) the exercise prescription of one crew member.
 * Only the exercise field changes: the medication plan stays as it is.
 */
export async function savePrescription(
  mission: string,
  crewMember: string,
  input: unknown,
  author?: string,
  now = new Date(),
): Promise<Result<CrewPlan>> {
  if (!(await findMission(mission, now))) return fail(404, `Mission ${mission} does not exist`);
  const prescription = input === null ? undefined : cleanPrescription(input, exerciseConfig);
  if (input !== null && !prescription) return fail(400, 'Invalid exercise prescription');
  const meta = { updatedAt: now.toISOString(), ...(author ? { author: author.slice(0, 80) } : {}) };
  await (await plans()).updateOne(
    { mission, crewMember },
    {
      $set: prescription ? { ...meta, exercise: prescription } : meta,
      ...(prescription ? {} : { $unset: { exercise: '' } }),
      $setOnInsert: { mission, crewMember, medications: [] },
    },
    { upsert: true },
  );
  return { ok: true, status: 200, data: await getPlan(mission, crewMember) };
}
