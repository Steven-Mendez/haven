import { fileURLToPath } from 'node:url';
import {
  type Assessment,
  computeBaseline,
  dailyProgress,
  evaluate,
  type Packet,
  type Reading,
} from '@haven/core';
import { demoHistory, ecgFromReadings, scenarioReadings, scenarios } from '@haven/core/testdata';
import { MongoClient } from 'mongodb';
import {
  baseConfig,
  COLLECTIONS,
  type MissionDoc,
  missionDay,
  type PacketDoc,
  packetDoc,
} from '../src/server/model';
import { mongoDbName, mongoUri } from '../src/server/mongo-env';

const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;
const HISTORY_DAYS = 30;

type Story =
  | 'nominal'
  | 'sleep-debt'
  | 'cabin-air'
  | 'radiation'
  | 'deconditioning'
  | 'low-oxygen'
  | 'chest-pain'
  | 'silent';

type Member = { id: string; name: string; role?: [es: string, en: string]; story: Story };

const DEMOS: Record<string, { crew: Member[] }> = {
  DEMOLS: {
    crew: [
      {
        id: 'akira-tanaka',
        name: 'Akira Tanaka',
        role: ['Comandante', 'Commander'],
        story: 'nominal',
      },
      { id: 'amara-okafor', name: 'Amara Okafor', role: ['Piloto', 'Pilot'], story: 'radiation' },
      {
        id: 'lars-eriksson',
        name: 'Lars Eriksson',
        role: ['Especialista de misión', 'Mission specialist'],
        story: 'deconditioning',
      },
      {
        id: 'valentina-rossi',
        name: 'Valentina Rossi',
        role: ['Médica de vuelo', 'Flight surgeon'],
        story: 'cabin-air',
      },
    ],
  },
  DEMOST: {
    crew: [
      {
        id: 'priya-raman',
        name: 'Priya Raman',
        role: ['Comandante', 'Commander'],
        story: 'nominal',
      },
      {
        id: 'tomas-herrera',
        name: 'Tomás Herrera',
        role: ['Ingeniero de vuelo', 'Flight engineer'],
        story: 'cabin-air',
      },
      {
        id: 'chloe-dubois',
        name: 'Chloé Dubois',
        role: ['Científica', 'Science officer'],
        story: 'sleep-debt',
      },
      {
        id: 'kwame-mensah',
        name: 'Kwame Mensah',
        role: ['Ingeniero de vuelo', 'Flight engineer'],
        story: 'silent',
      },
      {
        id: 'yuki-sato',
        name: 'Yuki Sato',
        role: ['Médica de vuelo', 'Flight surgeon'],
        story: 'nominal',
      },
    ],
  },
  DEMOMC: {
    crew: [
      {
        id: 'elena-vega',
        name: 'Elena Vega',
        role: ['Comandante', 'Commander'],
        story: 'sleep-debt',
      },
      {
        id: 'mateo-rios',
        name: 'Mateo Ríos',
        role: ['Ingeniero de vuelo', 'Flight engineer'],
        story: 'chest-pain',
      },
      {
        id: 'samira-chen',
        name: 'Samira Chen',
        role: ['Médica de vuelo', 'Flight surgeon'],
        story: 'nominal',
      },
    ],
  },
  DEMOMS: {
    crew: [
      {
        id: 'noor-al-farsi',
        name: 'Noor Al-Farsi',
        role: ['Comandante', 'Commander'],
        story: 'nominal',
      },
      {
        id: 'mateus-oliveira',
        name: 'Mateus Oliveira',
        role: ['Geólogo', 'Geologist'],
        story: 'low-oxygen',
      },
      {
        id: 'ingrid-solberg',
        name: 'Ingrid Solberg',
        role: ['Ingeniera de sistemas', 'Systems engineer'],
        story: 'deconditioning',
      },
      {
        id: 'daniel-kim',
        name: 'Daniel Kim',
        role: ['Médico de vuelo', 'Flight surgeon'],
        story: 'cabin-air',
      },
    ],
  },
  DEMOFN: {
    crew: [
      {
        id: 'aroha-ngata',
        name: 'Aroha Ngata',
        role: ['Comandante', 'Commander'],
        story: 'nominal',
      },
      { id: 'emil-novak', name: 'Emil Novák', role: ['Piloto', 'Pilot'], story: 'sleep-debt' },
    ],
  },
  DEMOSC: {
    crew: [
      {
        id: 'zainab-hussein',
        name: 'Zainab Hussein',
        role: ['Comandante', 'Commander'],
        story: 'nominal',
      },
      { id: 'rafael-montoya', name: 'Rafael Montoya', role: ['Piloto', 'Pilot'], story: 'nominal' },
      {
        id: 'mei-lin',
        name: 'Mei Lin',
        role: ['Especialista de misión', 'Mission specialist'],
        story: 'nominal',
      },
    ],
  },
  HACKAT: {
    crew: [
      { id: 'steven-mendez', name: 'Steven Mendez', story: 'nominal' },
      { id: 'bradly-gutierrez', name: 'Bradly Gutierrez', story: 'sleep-debt' },
      { id: 'jose-zapata', name: 'Jose Zapata', story: 'cabin-air' },
      { id: 'ana-marbell', name: 'Ana Marbell', story: 'nominal' },
      { id: 'samantha-moreno', name: 'Samantha Moreno', story: 'deconditioning' },
    ],
  },
};

const NOTES: Partial<Record<Story, string>> = {
  'sleep-debt': 'Llevo varias noches durmiendo mal y me cuesta concentrarme en las pruebas.',
  'cabin-air': 'La presión de la cabina lleva días por debajo de lo normal; dormimos peor.',
  radiation: 'La dosis de radiación subió de golpe durante la salida; volvimos al refugio.',
  deconditioning: 'No he podido completar el ejercicio resistivo por fallos del equipo.',
  'low-oxygen': 'Me falta el aire al subir la rampa del hábitat; la saturación marcó bajo.',
  'chest-pain':
    'Presión en el pecho durante el ejercicio de resistencia. Protocolo iniciado a bordo.',
};

process.loadEnvFile(fileURLToPath(new URL('../.env.local', import.meta.url)));

const codes = process.argv.slice(2).map((c) => c.toUpperCase());
if (codes.length === 0) {
  console.error(
    `Usage: pnpm --filter web seed:demos <CODE>…  (known: ${Object.keys(DEMOS).join(', ')})`,
  );
  process.exit(1);
}

const config = baseConfig();
const iso = (ms: number) => new Date(ms).toISOString();
const round = (v: number, decimals = 0) => Number(v.toFixed(decimals));
const wave = (t: number, span: number) => 0.5 + 0.5 * Math.sin(t / span);

function withStory(readings: Reading[], story: Story, end: number): Reading[] {
  const change = (
    indicator: string,
    days: number,
    value: (r: Reading & { value: number }, progress: number) => number,
  ) => {
    const from = end - days * DAY;
    for (const r of readings) {
      const t = Date.parse(r.takenAt);
      if (r.indicator === indicator && typeof r.value === 'number' && t >= from) {
        r.value = value(r as Reading & { value: number }, (t - from) / (days * DAY));
      }
    }
  };
  const t = (r: Reading) => Date.parse(r.takenAt);
  switch (story) {
    case 'sleep-debt':
      change('sleep', 7, (r) => round(4.6 + wave(t(r), DAY) * 1.1, 1));
      change('mood', 6, () => 2);
      change('stress', 6, () => 4);
      change('reaction-time', 6, (r, p) => round(r.value * (1.15 + 0.2 * p)));
      change('pvt-lapses', 5, (r) => 2 + Math.round(wave(t(r), DAY)));
      break;
    case 'cabin-air':
      change('cabin-pressure', 4, (r) => round(94.2 + wave(t(r), 6 * HOUR) * 1.8, 1));
      change('sleep', 3, (r) => round(5.6 + wave(t(r), DAY) * 0.8, 1));
      break;
    case 'radiation':
      change('radiation-dose', 1, (_r, p) => round(12 + 22 * p, 1));
      change('radiation-dose', 5, (r) => round(Math.max(r.value, 1.4), 1));
      break;
    case 'deconditioning':
      change('resistance-exercise', 12, (r) => round(18 + wave(t(r), DAY) * 18));
      change('food-intake', 8, (r) => round(1480 + wave(t(r), DAY) * 240));
      change('steps', 12, (r) => round(r.value * 0.55));
      break;
    case 'low-oxygen':
      change('spo2', 3, (_r, p) => round(93 - 5 * p));
      change('heart-rate', 2, (r, p) => round(r.value * (1.1 + 0.15 * p)));
      break;
    default:
      break;
  }
  return readings;
}

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

function packetsFor(mission: MissionDoc, member: Member, offsetMinutes: number): PacketDoc[] {
  const end = mission.finishedAt
    ? Date.parse(mission.finishedAt)
    : Math.min(Date.now(), Date.parse(mission.start) + mission.durationDays * DAY);
  const last = end - offsetMinutes * MINUTE - (member.story === 'silent' ? 3 * DAY : 0);
  const days = Math.min(HISTORY_DAYS, Math.max(1, missionDay(mission.start, new Date(end))));
  const history = withStory(
    demoHistory(member.id, new Date(last), { days: HISTORY_DAYS }).map((r) => ({
      ...r,
      crewMember: member.id,
      simulated: false,
    })),
    member.story,
    last,
  );
  const skipped = new Set(member.story === 'silent' ? [5, 6, 11, 12, 13] : []);
  const plans: { at: number; type: Packet['type']; extra?: Reading[]; notes?: string }[] = [];
  for (let k = days - 1; k >= 0; k--) {
    if (skipped.has(k)) continue;
    plans.push({
      at: last - k * DAY,
      type: 'routine',
      ...(k === 0 ? { notes: NOTES[member.story] } : {}),
    });
  }
  if (member.story === 'chest-pain') {
    const scenario = scenarios.find((s) => s.id === 'video');
    const start = end - 50 * MINUTE;
    const routine = plans.at(-1);
    if (routine) routine.notes = undefined;
    plans.push({
      at: end - 35 * MINUTE,
      type: 'emergency',
      extra: scenario
        ? scenarioReadings(scenario, member.id, new Date(start)).map((r) => ({
            ...r,
            simulated: false,
          }))
        : [],
      notes: NOTES['chest-pain'],
    });
  }
  const docs: PacketDoc[] = [];
  let previousAt = 0;
  plans.forEach((plan, n) => {
    const all = [...history, ...(plan.extra ?? [])];
    const known = all.filter((r) => Date.parse(r.takenAt) <= plan.at);
    const sentAt = iso(plan.at);
    const packet: Packet = {
      id: `demo-${mission.code}-${member.id}-${String(n + 1).padStart(3, '0')}`,
      type: plan.type,
      crewMember: member.id,
      assessments: assess(all, mission.environment, plan.at),
      readings: known.filter((r) => Date.parse(r.takenAt) > previousAt),
      notes: plan.notes ?? '',
      dailyProgress: dailyProgress(known, config, new Date(plan.at)),
      mission: mission.code,
      createdAt: sentAt,
      sentAt,
      visibleAt: sentAt,
      ...(plan.type === 'emergency'
        ? { ecg: ecgFromReadings(known, { now: new Date(plan.at), crewMember: member.id }) }
        : {}),
    };
    docs.push(packetDoc(packet, new Date(plan.at)));
    previousAt = plan.at;
  });
  return docs;
}

function countBy(values: string[]) {
  return values.reduce<Record<string, number>>((acc, v) => {
    acc[v] = (acc[v] ?? 0) + 1;
    return acc;
  }, {});
}

const client = await new MongoClient(mongoUri(), { serverSelectionTimeoutMS: 5000 }).connect();
try {
  const db = client.db(mongoDbName());
  const missions = db.collection<MissionDoc>(COLLECTIONS.missions);
  const packets = db.collection<PacketDoc>(COLLECTIONS.packets);
  for (const code of codes) {
    const demo = DEMOS[code];
    const mission = await missions.findOne({ code }, { projection: { _id: 0 } });
    if (!demo || !mission) {
      console.warn(`${code}: ${demo ? 'mission not found' : 'no demo defined'}, skipped`);
      continue;
    }
    const started = !mission.awaitingStart && Date.parse(mission.start) <= Date.now();
    const docs = started ? demo.crew.flatMap((m, i) => packetsFor(mission, m, 15 + i * 20)) : [];
    await packets.deleteMany({ mission: code, id: { $regex: `^demo-${code}-` } });
    if (docs.length) await packets.insertMany(docs.map((d) => ({ ...d })));
    const hasWatch = new Set(
      docs.filter((d) => d.readings.some((r) => r.source === 'watch')).map((d) => d.crewMember),
    );
    const crew = demo.crew.map((m) => ({
      id: m.id,
      name: m.name,
      hasWatch: hasWatch.has(m.id),
      ...(m.role ? { role: { es: m.role[0], en: m.role[1] } } : {}),
    }));
    await missions.updateOne({ code }, { $set: { crew } });
    console.log(`${code} (${mission.name}): ${docs.length} packets`);
    for (const m of demo.crew) {
      const own = docs.filter((d) => d.crewMember === m.id);
      const levels = own.at(-1)?.assessments.map((a) => a.level) ?? [];
      console.log(
        `  ${m.name} [${m.story}]: ${own.length} packets, last ${JSON.stringify(countBy(levels))}`,
      );
    }
  }
} finally {
  await client.close();
}
