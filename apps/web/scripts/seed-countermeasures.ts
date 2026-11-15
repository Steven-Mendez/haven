// Demo of the countermeasure features: reentry preparation (DEMORE) and EVA
// prebreathe with the post-EVA decompression check (DEMOEV).
//
//   pnpm --filter web seed:countermeasures
//
// Each mission has crew members in every state plus an empty "Revisor" seat to
// join from the app on the simulator and go through the flows by hand.
import { fileURLToPath } from 'node:url';
import {
  type Assessment,
  computeBaseline,
  dailyProgress,
  eva,
  evaluate,
  type MissionPhase,
  missionDays,
  missionTemplates,
  orthostaticReadings,
  type Packet,
  postEvaReadings,
  prebreatheReading,
  type Reading,
  reentryCheckReading,
} from '@haven/core';
import { demoHistory } from '@haven/core/testdata';
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
const HISTORY_DAYS = 7;

process.loadEnvFile(fileURLToPath(new URL('../.env.local', import.meta.url)));

const config = baseConfig();
const now = Date.now();
const iso = (ms: number) => new Date(ms).toISOString();
let seq = 0;
const newId = () => `cm-${(++seq).toString(36)}`;

type Member = {
  id: string;
  name: string;
  role: [es: string, en: string];
  /** Readings added to the last packet, built with the same helpers the app uses. */
  extra?: (member: string, at: number) => Reading[];
  /** Changes the history of the last day. */
  tweak?: (readings: Reading[], at: number) => void;
  note?: string;
  /** No packets: the seat for the app on the simulator. */
  empty?: boolean;
};

type Demo = {
  code: string;
  name: string;
  template: string;
  /** Phase environment the mission is in today. */
  today: string;
  crew: Member[];
};

const phasesOf = (template: string): MissionPhase[] =>
  missionTemplates.find((t) => t.id === template)?.phases ?? [];

/** Mission day on which the first phase in `environment` starts. */
function firstDayOf(phases: MissionPhase[], environment: string): number {
  let day = 1;
  for (const p of phases) {
    if (p.environment === environment) return day;
    day += p.days;
  }
  return 1;
}

const opts = (member: string, at: number) => ({ crewMember: member, takenAt: iso(at), newId });
const method = (id: string) => {
  const m = eva.methods.find((x) => x.id === id);
  if (!m) throw new Error(`unknown prebreathe method ${id}`);
  return m;
};
const lastDay = (readings: Reading[], at: number, indicator: string, value: number) => {
  for (const r of readings) {
    const t = Date.parse(r.takenAt);
    if (r.indicator === indicator && t > at - DAY && t <= at) r.value = value;
  }
};

const REVIEWER: Member = {
  id: 'revisor',
  name: 'Revisor (tu app)',
  role: ['Revisión', 'Review'],
  empty: true,
};

const DEMOS: Demo[] = [
  {
    code: 'DEMORE',
    name: 'Demo reentrada',
    template: 'lunar-flyby',
    today: 'reentry',
    crew: [
      {
        id: 'lucia-ortiz',
        name: 'Lucía Ortiz',
        role: ['Comandante', 'Commander'],
        note: 'Lista completa: líquidos, prenda de compresión y prueba ortostática sin síntomas.',
        extra: (m, at) => [
          reentryCheckReading('fluid-loading', opts(m, at - 90 * MINUTE)),
          reentryCheckReading('compression-garment', opts(m, at - 60 * MINUTE)),
          ...orthostaticReadings(
            { supine: 64, standing: 78, symptoms: [] },
            { ...opts(m, at - 30 * MINUTE), supineAt: iso(at - 35 * MINUTE) },
          ),
        ],
      },
      {
        id: 'omar-haddad',
        name: 'Omar Haddad',
        role: ['Piloto', 'Pilot'],
        note: 'El pulso me sube bastante al ponerme de pie. Aún no me he puesto la prenda.',
        extra: (m, at) => [
          reentryCheckReading('fluid-loading', opts(m, at - 80 * MINUTE)),
          ...orthostaticReadings(
            { supine: 66, standing: 100, symptoms: [] },
            { ...opts(m, at - 20 * MINUTE), supineAt: iso(at - 25 * MINUTE) },
          ),
        ],
      },
      {
        id: 'nina-petrova',
        name: 'Nina Petrova',
        role: ['Especialista de misión', 'Mission specialist'],
        note: 'Mareo fuerte al levantarme en la prueba; he bebido poco hoy.',
        tweak: (rs, at) => lastDay(rs, at, 'hydration', 1200),
        extra: (m, at) =>
          orthostaticReadings(
            { supine: 70, standing: 96, symptoms: ['dizziness'] },
            { ...opts(m, at - 15 * MINUTE), supineAt: iso(at - 20 * MINUTE) },
          ),
      },
      {
        id: 'tomas-reyes',
        name: 'Tomás Reyes',
        role: ['Ingeniero de vuelo', 'Flight engineer'],
        note: 'Todavía no he empezado la preparación.',
      },
      REVIEWER,
    ],
  },
  {
    code: 'DEMOEV',
    name: 'Demo EVA lunar',
    template: 'lunar-landing',
    today: 'moon',
    crew: [
      {
        id: 'kai-nakamura',
        name: 'Kai Nakamura',
        role: ['Comandante', 'Commander'],
        note: 'Salida de 6 h sin incidencias.',
        extra: (m, at) => [
          prebreatheReading(
            { method: method('exploration'), startedAt: iso(at - 8 * HOUR - 20 * MINUTE) },
            opts(m, at - 8 * HOUR),
          ),
          ...postEvaReadings([], opts(m, at - HOUR)),
        ],
      },
      {
        id: 'sofia-mendes',
        name: 'Sofía Mendes',
        role: ['Geóloga', 'Geologist'],
        note: 'Tuve que quitarme la mascarilla a los 8 minutos; el O₂ del módulo marca bajo.',
        tweak: (rs, at) => lastDay(rs, at, 'cabin-o2', 17.8),
        extra: (m, at) => [
          prebreatheReading(
            { method: method('exploration'), startedAt: iso(at - 38 * MINUTE) },
            opts(m, at - 30 * MINUTE),
          ),
        ],
      },
      {
        id: 'diego-alvarez',
        name: 'Diego Álvarez',
        role: ['Médico de vuelo', 'Flight surgeon'],
        note: 'Dolor en el codo derecho y el hombro al volver de la salida. Protocolo de descompresión iniciado.',
        extra: (m, at) => [
          prebreatheReading(
            { method: method('exploration'), startedAt: iso(at - 7 * HOUR - 15 * MINUTE) },
            opts(m, at - 7 * HOUR),
          ),
          ...postEvaReadings(['joint-pain'], opts(m, at - 40 * MINUTE)),
        ],
      },
      REVIEWER,
    ],
  },
];

function assess(readings: Reading[], environment: string, at: number): Assessment[] {
  const known = readings.filter((r) => Date.parse(r.takenAt) <= at);
  const baselines: Record<string, Assessment['baseline']> = {};
  for (const indicator of config.indicators) {
    baselines[indicator.id] = computeBaseline(known, indicator.id);
  }
  const symptoms = known.filter((r) => r.indicator === 'symptom');
  return evaluate(known, config, environment, baselines, symptoms, new Date(at)).map((a) => ({
    ...a,
    simulated: false,
  }));
}

function packetsFor(demo: Demo, member: Member, last: number): PacketDoc[] {
  const history = demoHistory(member.id, new Date(last), { days: HISTORY_DAYS }).map((r) => ({
    ...r,
    crewMember: member.id,
    simulated: false,
  }));
  member.tweak?.(history, last);
  const extra = member.extra?.(member.id, last) ?? [];
  const all = [...history, ...extra];
  const docs: PacketDoc[] = [];
  let previousAt = 0;
  for (let k = HISTORY_DAYS - 1; k >= 0; k--) {
    const at = last - k * DAY;
    const known = all.filter((r) => Date.parse(r.takenAt) <= at);
    const packet: Packet = {
      id: `demo-${demo.code}-${member.id}-${String(HISTORY_DAYS - k).padStart(3, '0')}`,
      type: 'routine',
      crewMember: member.id,
      assessments: assess(all, demo.today, at),
      readings: known.filter((r) => Date.parse(r.takenAt) > previousAt),
      notes: k === 0 ? (member.note ?? '') : '',
      dailyProgress: dailyProgress(known, config, new Date(at)),
      mission: demo.code,
      createdAt: iso(at),
      sentAt: iso(at),
      visibleAt: iso(at),
    };
    docs.push(packetDoc(packet, new Date(at)));
    previousAt = at;
  }
  return docs;
}

const client = await new MongoClient(mongoUri(), { serverSelectionTimeoutMS: 5000 }).connect();
try {
  const db = client.db(mongoDbName());
  for (const [name, indexes] of Object.entries(INDEXES)) {
    for (const i of indexes)
      await db.collection(name).createIndex(i.key, i.unique ? { unique: true } : {});
  }
  for (const demo of DEMOS) {
    const phases = phasesOf(demo.template);
    const day = firstDayOf(phases, demo.today) + (demo.today === 'reentry' ? 0 : 2);
    const docs = demo.crew
      .filter((m) => !m.empty)
      .flatMap((m, i) => packetsFor(demo, m, now - (10 + i * 7) * MINUTE));
    const hasWatch = new Set(
      docs.filter((d) => d.readings.some((r) => r.source === 'watch')).map((d) => d.crewMember),
    );
    const mission: MissionDoc = {
      code: demo.code,
      name: demo.name,
      environment: demo.today,
      day,
      currentDelayMin: 0,
      linkDown: false,
      crew: demo.crew.map((m) => ({
        id: m.id,
        name: m.name,
        hasWatch: hasWatch.has(m.id),
        role: { es: m.role[0], en: m.role[1] },
      })),
      start: iso(now - (day - 1) * DAY - HOUR),
      durationDays: missionDays(phases),
      phases,
      createdAt: iso(now),
      origin: 'seed',
    };
    await Promise.all([
      db.collection(COLLECTIONS.packets).deleteMany({ mission: demo.code }),
      db.collection(COLLECTIONS.missions).deleteMany({ code: demo.code }),
      db.collection(COLLECTIONS.rules).deleteMany({ mission: demo.code }),
    ]);
    await db.collection<MissionDoc>(COLLECTIONS.missions).insertOne({ ...mission });
    if (docs.length) await db.collection<PacketDoc>(COLLECTIONS.packets).insertMany(docs);
    console.log(`${demo.code} (${demo.name}), day ${day} in ${demo.today}: ${docs.length} packets`);
    for (const m of demo.crew) console.log(`  ${m.id}${m.empty ? ' (seat for the app)' : ''}`);
  }
} finally {
  await client.close();
}
