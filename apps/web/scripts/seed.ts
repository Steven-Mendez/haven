// T01 backend · Seeds the Ares-1 mission (ARES01) so the Earth view has records without a phone.
//
//   pnpm --filter web seed
//
// Deletes and recreates ARES01 (packets, mission, rules, access log); other missions are untouched.
// Test records come from `@haven/core/testdata` (demoHistory, scenario readings, ECG strip) and are
// stored as plain data (`simulated: false`). Assessments are the engine's real output (evaluate).
// Every packet is already received (no artificial delay, nothing in transit):
//   · ~30 daily routine packets per astronaut
//   · Elena Vega: latest packet 40 min ago, with a private note
//   · Mateo Ríos: emergency packet 45 min ago (scenario "video", chest pain) with its ECG strip
//   · Samira Chen: latest packet 8 h ago → "no recent data" (threshold NO_RECENT_DATA_HOURS = 6)

import { fileURLToPath } from 'node:url';
import {
  type Assessment,
  computeBaseline,
  dailyProgress,
  evaluate,
  missionDays,
  missionTemplates,
  type Packet,
  type Reading,
} from '@haven/core';
import {
  DEMO_MISSION,
  DEMO_MISSION_NAME,
  demoHistory,
  ecgFromReadings,
  scenarioReadings,
  scenarios,
} from '@haven/core/testdata';
import { MongoClient } from 'mongodb';
import {
  baseConfig,
  COLLECTIONS,
  INDEXES,
  type MissionDoc,
  type PacketDoc,
  packetDoc,
} from '../src/server/model';
import { mongoDbName, mongoUri } from '../src/server/mongo-env';

const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;
/** Ares-1 follows the conjunction-class Mars plan: on day 142 it is in the cruise to Mars. */
const PHASES = missionTemplates.find((t) => t.id === 'mars-conjunction')?.phases ?? [];

process.loadEnvFile(fileURLToPath(new URL('../.env.local', import.meta.url)));
const uri = mongoUri();
const dbName = mongoDbName();

const now = new Date();
const config = baseConfig();
const mission = DEMO_MISSION;

const iso = (ms: number) => new Date(ms).toISOString();
/** Records are plain data: the frozen `simulated` field is always false. */
const asRecord = (r: Reading): Reading => ({ ...r, simulated: false });

/** Assessments exactly as the phone would compute them at instant `at` with the readings it had. */
function assess(readings: Reading[], at: number): Assessment[] {
  const known = readings.filter((r) => Date.parse(r.takenAt) <= at);
  const baselines: Record<string, Assessment['baseline']> = {};
  for (const indicator of config.indicators) {
    baselines[indicator.id] = computeBaseline(known, indicator.id);
  }
  const symptoms = known.filter((r) => r.indicator === 'symptom');
  return evaluate(known, config, mission.environment, baselines, symptoms, new Date(at)).map(
    (a) => ({ ...a, simulated: false }),
  );
}

type Plan = {
  crewMember: string;
  at: number; // createdAt = sentAt = receivedAt
  type: Packet['type'];
  notes?: string;
  extraReadings?: Reading[];
  withEcg?: boolean;
};

function buildPacket(plan: Plan, history: Reading[], previousAt: number, n: number): PacketDoc {
  const all = [...history, ...(plan.extraReadings ?? [])].map(asRecord);
  const known = all.filter((r) => Date.parse(r.takenAt) <= plan.at);
  const readings = known.filter((r) => Date.parse(r.takenAt) > previousAt);
  const sentAt = iso(plan.at);
  const packet: Packet = {
    id: `seed-${plan.crewMember}-${String(n).padStart(3, '0')}`,
    type: plan.type,
    crewMember: plan.crewMember,
    assessments: assess(all, plan.at),
    readings,
    notes: plan.notes ?? '',
    dailyProgress: dailyProgress(known, config, new Date(plan.at)),
    mission: mission.code,
    createdAt: sentAt,
    sentAt,
    visibleAt: sentAt,
    ...(plan.withEcg
      ? { ecg: ecgFromReadings(known, { now: new Date(plan.at), crewMember: plan.crewMember }) }
      : {}),
  };
  return packetDoc(packet, new Date(plan.at));
}

/** Chest-pain records (scenario "video") starting at `start`. */
function chestPainReadings(crewMember: string, start: number): Reading[] {
  const scenario = scenarios.find((s) => s.id === 'video');
  return scenario ? scenarioReadings(scenario, crewMember, new Date(start)) : [];
}

function plansFor(crewMember: string): Plan[] {
  const daily = (lastAt: number): Plan[] =>
    Array.from({ length: 29 }, (_, k) => ({
      crewMember,
      at: lastAt - (28 - k) * DAY,
      type: 'routine' as const,
    }));

  if (crewMember === 'elena-vega') {
    return [
      ...daily(now.getTime() - DAY),
      {
        crewMember,
        at: now.getTime() - 40 * MINUTE,
        type: 'routine',
        notes: 'Dormí poco por el ruido del ventilador; me noto algo cansada.',
      },
    ];
  }
  if (crewMember === 'mateo-rios') {
    const emergencyStart = now.getTime() - 60 * MINUTE;
    return [
      ...daily(now.getTime() - DAY),
      { crewMember, at: now.getTime() - 3 * HOUR, type: 'routine' },
      {
        crewMember,
        at: now.getTime() - 45 * MINUTE,
        type: 'emergency',
        extraReadings: chestPainReadings(crewMember, emergencyStart),
        withEcg: true,
        notes:
          'Presión en el pecho durante el ejercicio de resistencia. Protocolo iniciado a bordo.',
      },
    ];
  }
  // samira-chen and anyone else: the latest packet is 8 h old.
  return daily(now.getTime() - 8 * HOUR);
}

async function main() {
  const client = await new MongoClient(uri, { serverSelectionTimeoutMS: 3000 }).connect();
  try {
    const db = client.db(dbName);
    for (const [name, indexes] of Object.entries(INDEXES)) {
      for (const i of indexes)
        await db.collection(name).createIndex(i.key, i.unique ? { unique: true } : {});
    }
    await Promise.all([
      db.collection(COLLECTIONS.packets).deleteMany({ mission: mission.code }),
      db.collection(COLLECTIONS.missions).deleteMany({ code: mission.code }),
      db.collection(COLLECTIONS.rules).deleteMany({ mission: mission.code }),
    ]);

    // `crew[].role` is stored with the mission: the API reads roles from here.
    const histories = new Map(mission.crew.map((m) => [m.id, demoHistory(m.id, now)]));
    // A crew member wears a watch when their records include readings from it.
    const crew = mission.crew.map((m) => ({
      ...m,
      hasWatch: (histories.get(m.id) ?? []).some((r) => r.source === 'watch'),
    }));
    const missionDoc: MissionDoc = {
      ...mission,
      crew,
      name: DEMO_MISSION_NAME,
      start: iso(now.getTime() - (mission.day - 1) * DAY),
      durationDays: missionDays(PHASES),
      phases: PHASES,
      createdAt: now.toISOString(),
      origin: 'seed',
    };
    await db.collection<MissionDoc>(COLLECTIONS.missions).insertOne({ ...missionDoc });

    const docs: PacketDoc[] = [];
    const warnings: string[] = [];
    for (const member of mission.crew) {
      const history = histories.get(member.id) ?? [];
      if (history.length === 0) warnings.push(`demoHistory('${member.id}') returned no readings`);
      let previousAt = 0;
      plansFor(member.id).forEach((plan, n) => {
        docs.push(buildPacket(plan, history, previousAt, n + 1));
        previousAt = plan.at;
      });
    }
    await db.collection<PacketDoc>(COLLECTIONS.packets).insertMany(docs.map((d) => ({ ...d })));

    console.log(`Seeded ${mission.code} (${missionDoc.name}) in ${dbName}: ${docs.length} packets`);
    for (const member of mission.crew) {
      const own = docs.filter((d) => d.crewMember === member.id);
      const levels = own.at(-1)?.assessments.map((a) => a.level) ?? [];
      console.log(
        `  ${member.id}: ${own.length} packets, ${own.reduce((s, d) => s + d.readings.length, 0)} readings, last levels ${JSON.stringify(countBy(levels))}`,
      );
    }
    for (const w of warnings) console.warn(`  warning: ${w}`);
  } finally {
    await client.close();
  }
}

function countBy(values: string[]) {
  return values.reduce<Record<string, number>>((acc, v) => {
    acc[v] = (acc[v] ?? 0) + 1;
    return acc;
  }, {});
}

await main();
