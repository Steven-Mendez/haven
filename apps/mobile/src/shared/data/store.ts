import {
  type Assessment,
  activeSymptoms,
  computeBaselines,
  evaluate,
  evaluateZones,
  type Level,
  type Mission,
  type Reading,
} from '@haven/core';
import { activeConfig, onConfigChange } from '@/shared/config';
import { db } from '@/shared/db';
import { bus } from '@/shared/events';
import { currentLanguage, onLanguageChange, setLanguage } from '@/shared/i18n';
import { defaultPreferences, type Preferences, withoutRemovedSettings } from './preferences';

// Local store (M00, contract B). Single source of readings, assessments, mission and preferences.
// Everything lives in memory so it can be read synchronously, and is persisted in `@/shared/db`.
// Features read through the hooks in `./hooks` and write only through `store.*`.

export type Topic = 'readings' | 'assessments' | 'mission' | 'preferences' | 'queue' | 'ready';
export type Baseline = NonNullable<Assessment['baseline']>;
export type Zones = ReturnType<typeof evaluateZones>;
export type ReadingFilter = {
  indicator?: string;
  /** ISO 8601, inclusive. */
  since?: string;
  /** ISO 8601, inclusive. */
  until?: string;
  /** Defaults to the crew member in the preferences. */
  crewMember?: string;
};

/** Symptom readings (screen questionnaire, M03/M06); `activeSymptoms` keeps the last 6 h. */
const SYMPTOM_INDICATOR = 'symptom';
const MISSION_KEY = 'current';
const clone = <T>(value: T): T => JSON.parse(JSON.stringify(value)) as T;

/**
 * Mission record on first launch (and after «Delete data»): Ares-1, a mission like any other that
 * Mission (M05) can replace by creating or joining one with its code. Data, not a generator.
 */
const INITIAL_MISSION: Mission = {
  code: 'ARES01',
  environment: 'transit',
  day: 142,
  currentDelayMin: 11,
  linkDown: false,
  crew: [
    { id: 'elena-vega', name: 'Elena Vega', hasWatch: false },
    { id: 'mateo-rios', name: 'Mateo Ríos', hasWatch: false },
    { id: 'samira-chen', name: 'Samira Chen', hasWatch: false },
  ],
};

// ---- in-memory state ----
let ready = false;
let readings: Reading[] = []; // sorted by takenAt
const ids = new Set<string>();
let assessments: Assessment[] = [];
let zones: Zones = [];
let baselines: Record<string, Baseline | undefined> = {};
let mission: Mission = clone(INITIAL_MISSION);
let preferences: Preferences = defaultPreferences();
let pendingSends = 0;
let queueCounter: (() => number | Promise<number>) | null = null;
let assessmentsSignature = '';
/** ISO time of the last successful evaluation (undefined until the first one). */
let evaluatedAt: string | undefined;

// ---- subscriptions (for useSyncExternalStore) ----
const listeners = new Map<Topic, Set<() => void>>();
const versions: Record<Topic, number> = {
  readings: 0,
  assessments: 0,
  mission: 0,
  preferences: 0,
  queue: 0,
  ready: 0,
};

function notify(topic: Topic) {
  versions[topic]++;
  for (const listener of [...(listeners.get(topic) ?? [])]) listener();
}

function subscribe(topic: Topic, listener: () => void): () => void {
  const set = listeners.get(topic) ?? new Set();
  set.add(listener);
  listeners.set(topic, set);
  return () => set.delete(listener);
}

// ---- serialized persistence (avoids concurrent transactions) ----
let chain: Promise<unknown> = Promise.resolve();
function serial<T>(task: () => Promise<T>): Promise<T> {
  const next = chain.then(task, task);
  chain = next.catch((error) => console.warn('[data] persistence failed', error));
  return next;
}

let unsaved: Reading[] = [];
let flushing: Promise<void> | null = null;
function persistReadings(items: Reading[]): Promise<void> {
  unsaved.push(...items);
  flushing ??= Promise.resolve().then(() => {
    const batch = unsaved;
    unsaved = [];
    flushing = null;
    return serial(() => db.readings.put(batch));
  });
  return flushing;
}

// ---- queries ----
const queryCache = new Map<string, { version: number; result: Reading[] }>();

function query(filter: ReadingFilter = {}): Reading[] {
  const crewMember = filter.crewMember ?? preferences.crewMember;
  const key = `${crewMember}|${filter.indicator ?? ''}|${filter.since ?? ''}|${filter.until ?? ''}`;
  const cached = queryCache.get(key);
  if (cached && cached.version === versions.readings) return cached.result;
  const result = readings.filter(
    (r) =>
      r.crewMember === crewMember &&
      (!filter.indicator || r.indicator === filter.indicator) &&
      (!filter.since || r.takenAt >= filter.since) &&
      (!filter.until || r.takenAt <= filter.until),
  );
  if (queryCache.size > 200) queryCache.clear();
  queryCache.set(key, { version: versions.readings, result });
  return result;
}

function latestReading(indicator: string, crewMember?: string): Reading | undefined {
  const list = query({ indicator, crewMember });
  return list[list.length - 1];
}

// ---- evaluation ----
function signature(list: Assessment[]) {
  return list
    .map((a) => `${a.indicator}:${a.level}:${a.value ?? ''}:${a.simulated ? 1 : 0}`)
    .join('|');
}

/** Re-evaluates with the engine (C01). Emits 'assessments:changed' when a level or value changed. */
function reevaluate(now: Date = new Date()): Assessment[] {
  const own = query();
  const config = activeConfig();
  const nextBaselines = computeBaselines(
    own,
    config.indicators.map((i) => i.id),
  );
  const symptoms = activeSymptoms(
    own.filter((r) => r.indicator === SYMPTOM_INDICATOR),
    now,
  );
  try {
    assessments = evaluate(own, config, mission.environment, nextBaselines, symptoms, now);
    zones = evaluateZones(assessments, config);
  } catch (error) {
    console.warn('[data] evaluate() failed', error);
    return assessments;
  }
  baselines = nextBaselines;
  evaluatedAt = now.toISOString();
  notify('assessments');
  const next = signature(assessments);
  if (next !== assessmentsSignature) {
    assessmentsSignature = next;
    bus.emit('assessments:changed', assessments);
  }
  return assessments;
}

let scheduledEvaluation: Promise<void> | null = null;
function scheduleEvaluation(): Promise<void> {
  scheduledEvaluation ??= Promise.resolve().then(() => {
    scheduledEvaluation = null;
    reevaluate();
  });
  return scheduledEvaluation;
}

// ---- writing readings ----
function insert(items: Reading[]): Reading[] {
  const accepted: Reading[] = [];
  // The engine ignores future readings: a device with a wrong clock cannot write into the future.
  const now = new Date().toISOString();
  for (const r of items) {
    if (!r?.id || ids.has(r.id)) continue;
    ids.add(r.id);
    accepted.push(r.takenAt > now ? { ...r, takenAt: now } : r);
  }
  if (accepted.length === 0) return accepted;
  const last = readings[readings.length - 1];
  readings = [...readings, ...accepted];
  const unordered =
    accepted.length > 1 || (last && (accepted[0] as Reading).takenAt < last.takenAt);
  if (unordered) readings.sort((a, b) => a.takenAt.localeCompare(b.takenAt));
  notify('readings');
  return accepted;
}

/** Persists, emits 'reading:new', re-evaluates and emits 'assessments:changed'. Skips known ids. */
async function saveReadings(items: Reading[]): Promise<void> {
  const accepted = insert(items);
  if (accepted.length === 0) return;
  for (const r of accepted) bus.emit('reading:new', r);
  await Promise.all([persistReadings(accepted), scheduleEvaluation()]);
}

/**
 * Removes readings by id (e.g. HealthKit replacing a duplicate from the watch), persists and
 * re-evaluates. Unknown ids are ignored.
 */
async function removeReadings(removeIds: string[]): Promise<void> {
  const gone = new Set(removeIds.filter((id) => ids.has(id)));
  if (gone.size === 0) return;
  for (const id of gone) ids.delete(id);
  readings = readings.filter((r) => !gone.has(r.id));
  notify('readings');
  await Promise.all([serial(() => db.readings.remove([...gone])), scheduleEvaluation()]);
}

function saveReading(reading: Reading): Promise<void> {
  return saveReadings([reading]);
}

/**
 * Development only (`/dev` → «Load test data»): writes test readings as ordinary records, the same
 * way any real source does. Returns how many were new. The product never calls it.
 */
async function loadTestData(items: Reading[]): Promise<number> {
  const accepted = insert(items.map((r) => ({ ...r, simulated: false })));
  if (accepted.length === 0) return 0;
  await Promise.all([persistReadings(accepted), scheduleEvaluation()]);
  return accepted.length;
}

// ---- mission and preferences ----
async function setMission(changes: Partial<Mission>): Promise<void> {
  mission = { ...mission, ...changes };
  notify('mission');
  bus.emit('mission:changed', mission);
  reevaluate();
  await serial(() => db.keyValue('mission').set(MISSION_KEY, mission));
}

async function setPreferences(changes: Partial<Preferences>): Promise<void> {
  const previous = preferences;
  preferences = withoutRemovedSettings({ ...preferences, ...changes });
  notify('preferences');
  if (changes.language && changes.language !== currentLanguage()) setLanguage(changes.language);
  if (changes.crewMember && changes.crewMember !== previous.crewMember) {
    notify('readings');
    assessmentsSignature = '';
    reevaluate();
  }
  const table = db.keyValue('preferences');
  await serial(async () => {
    for (const [key, value] of Object.entries(changes)) {
      if (value === undefined) await table.remove(key);
      else await table.set(key, value);
    }
  });
}

// ---- queued sends (fed by M09) ----
async function refreshPendingSends(): Promise<void> {
  if (!queueCounter) return;
  try {
    const n = await queueCounter();
    if (n !== pendingSends) {
      pendingSends = n;
      notify('queue');
    }
  } catch (error) {
    console.warn('[data] queue counter failed', error);
  }
}

/** M09 registers how to count pending packets; the mission header shows it. */
export function registerQueueCounter(counter: () => number | Promise<number>) {
  queueCounter = counter;
  void refreshPendingSends();
}

bus.on('packet:queued', () => {
  if (queueCounter) void refreshPendingSends();
  else {
    pendingSends++;
    notify('queue');
  }
});

// ---- startup ----
let starting: Promise<void> | null = null;
let timer: ReturnType<typeof setInterval> | null = null;

async function load() {
  await db.open();
  const saved = (await db.keyValue('preferences').all()) as Partial<Preferences>;
  preferences = withoutRemovedSettings({ ...defaultPreferences(), ...saved });
  if (preferences.language !== currentLanguage()) setLanguage(preferences.language);
  mission = (await db.keyValue('mission').get<Mission>(MISSION_KEY)) ?? clone(INITIAL_MISSION);
  const persisted = await db.readings.all();
  readings = [];
  ids.clear();
  insert(persisted);
  notify('preferences');
  notify('mission');
}

/** Opens the db, loads mission, preferences and readings, and evaluates. Idempotent. No seeding. */
function start(): Promise<void> {
  starting ??= (async () => {
    try {
      await load();
    } catch (error) {
      console.warn('[data] could not load the database; running in memory', error);
    }
    reevaluate();
    ready = true;
    notify('ready');
    // Age grows even without new readings: re-evaluate every minute.
    timer ??= setInterval(() => reevaluate(), 60_000);
  })();
  return starting;
}

// Rules received from Earth (M05 → `setActiveConfig`) change thresholds: re-evaluate at once.
onConfigChange(() => {
  if (ready) reevaluate();
});

onLanguageChange((language) => {
  if (preferences.language !== language) void setPreferences({ language });
});

/** Deletes all local data (readings, preferences, mission, collections). Keeps the language. */
async function reset(): Promise<void> {
  await serial(() => db.reset());
  const { language } = preferences;
  readings = [];
  ids.clear();
  mission = clone(INITIAL_MISSION);
  preferences = { ...defaultPreferences(), language };
  pendingSends = 0;
  assessmentsSignature = '';
  notify('readings');
  notify('preferences');
  notify('mission');
  notify('queue');
  bus.emit('mission:changed', mission);
  await setPreferences({ language });
  reevaluate();
  void refreshPendingSends();
  // Features with their own caches (M09 queue…) clear them.
  bus.emit('data:reset', {});
}

function levelOf(indicator: string): Level {
  return assessments.find((a) => a.indicator === indicator)?.level ?? 'pending';
}

export const store = {
  start,
  isReady: () => ready,
  saveReading,
  saveReadings,
  removeReadings,
  loadTestData,
  /** Removes one reading (e.g. «Undo»): persists, re-evaluates and emits. */
  removeReading: (id: string) => removeReadings([id]),
  readings: query,
  latestReading,
  assessments: () => assessments,
  /** ISO time of the last evaluation; Body shows it as «evaluated at». */
  evaluatedAt: () => evaluatedAt,
  assessment: (indicator: string) => assessments.find((a) => a.indicator === indicator),
  level: levelOf,
  zones: () => zones,
  baseline: (indicator: string) => baselines[indicator],
  reevaluate,
  mission: () => mission,
  setMission,
  preferences: () => preferences,
  setPreferences,
  pendingSends: () => pendingSends,
  refreshPendingSends,
  reset,
  /** For hooks: notifies when a topic changes. Returns the unsubscribe function. */
  subscribe,
  version: (topic: Topic) => versions[topic],
  /** Stops the re-evaluation timer (tests). */
  stop() {
    if (timer) clearInterval(timer);
    timer = null;
  },
};
