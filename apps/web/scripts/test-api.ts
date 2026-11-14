import { fileURLToPath } from 'node:url';
import { MongoClient } from 'mongodb';
import { COLLECTIONS } from '../src/server/model';
import { mongoDbName, mongoUri } from '../src/server/mongo-env';
import type {
  AstronautResponse,
  CrewResponse,
  PacketReceipt,
  RulesVersion,
  StoredMission,
} from '../src/server/types';

process.loadEnvFile(fileURLToPath(new URL('../.env.local', import.meta.url)));
const BASE = process.env.API_URL ?? 'http://localhost:3000';

const results: { name: string; ok: boolean; detail?: string }[] = [];
function check(name: string, ok: boolean, detail?: unknown) {
  results.push({ name, ok, detail: ok ? undefined : JSON.stringify(detail)?.slice(0, 400) });
  console.log(
    `${ok ? '✔' : '✘'} ${name}${ok ? '' : `  → ${JSON.stringify(detail)?.slice(0, 400)}`}`,
  );
}

const code = () => `T${Math.random().toString(36).slice(2, 7).toUpperCase().padEnd(5, 'X')}`;

async function call<T>(method: string, path: string, body?: unknown, raw?: string) {
  const res = await fetch(BASE + path, {
    method,
    headers: body !== undefined || raw ? { 'Content-Type': 'application/json' } : undefined,
    body: raw ?? (body !== undefined ? JSON.stringify(body) : undefined),
  });
  const text = await res.text();
  return {
    status: res.status,
    headers: res.headers,
    text,
    data: (text ? JSON.parse(text) : null) as T,
  };
}

function packet(mission: string, crewMember: string, over: Record<string, unknown> = {}) {
  const sentAt = new Date().toISOString();
  return {
    id: `test-${crypto.randomUUID()}`,
    type: 'routine',
    crewMember,
    assessments: [
      {
        indicator: 'heart-rate',
        level: 'amber',
        value: 104,
        explanation: { es: 'Prueba', en: 'Test' },
        actions: [],
        ageMin: 1,
        simulated: false,
      },
    ],
    readings: [],
    notes: '',
    dailyProgress: [
      { zone: 'heart', progress: 1 },
      { zone: 'mind', progress: 0.5 },
    ],
    mission,
    createdAt: sentAt,
    sentAt,
    visibleAt: sentAt,
    ...over,
  };
}

const missionCodes: string[] = [];

async function testCors() {
  for (const path of [
    '/api/packets',
    '/api/crew',
    '/api/astronaut/x',
    '/api/missions',
    '/api/rules',
    '/api/health',
  ]) {
    const res = await fetch(BASE + path, {
      method: 'OPTIONS',
      headers: { Origin: 'http://example.test', 'Access-Control-Request-Method': 'POST' },
    });
    check(
      `CORS preflight ${path}`,
      res.status === 204 &&
        res.headers.get('access-control-allow-origin') === '*' &&
        (res.headers.get('access-control-allow-methods') ?? '').includes('POST'),
      { status: res.status, headers: Object.fromEntries(res.headers) },
    );
  }
  const health = await call<{ ok: boolean }>('GET', '/api/health');
  check(
    'GET /api/health answers with CORS *',
    health.status === 200 && health.headers.get('access-control-allow-origin') === '*',
    health,
  );
}

async function testInstantAndIdempotency() {
  const mission = code();
  missionCodes.push(mission);
  const takenAt = new Date(Date.now() - 5 * 60_000).toISOString();
  const sentAt = new Date().toISOString();
  const a = packet(mission, 'tester-a', {
    sentAt,
    visibleAt: new Date(Date.now() + 11 * 60_000).toISOString(),
    notes: 'secret note',
    readings: [
      {
        id: `r-${crypto.randomUUID()}`,
        indicator: 'heart-rate',
        value: 104,
        unit: 'bpm',
        takenAt,
        source: 'watch',
        simulated: false,
        crewMember: 'tester-a',
        note: 'secret reading note',
      },
    ],
  });
  const post = await call<PacketReceipt>('POST', '/api/packets', a);
  check(
    'POST /api/packets → 201 { id, receivedAt, visibleAt }',
    post.status === 201 && post.data.id === a.id,
    post,
  );
  check(
    'nothing is held back: visibleAt = receivedAt (future visibleAt from the phone ignored)',
    post.data.visibleAt === post.data.receivedAt && Date.parse(post.data.visibleAt) <= Date.now(),
    post.data,
  );
  check('CORS header on POST response', post.headers.get('access-control-allow-origin') === '*');

  const crew = await call<CrewResponse>('GET', `/api/crew?mission=${mission}`);
  const card = crew.data.crew?.find((c) => c.id === 'tester-a');
  check(
    'received data is visible at once on /api/crew (alerts, actions, lastPacket)',
    crew.status === 200 &&
      card?.lastPacket?.id === a.id &&
      card.alerts.length === 1 &&
      card.actionsDone === 1 &&
      card.noRecentData === false &&
      crew.data.summary.amberZones >= 0,
    card,
  );
  check(
    'age is measured from the reading time: lastDataAt = newest takenAt',
    card?.lastDataAt === takenAt,
    { lastDataAt: card?.lastDataAt, takenAt },
  );
  check(
    'no transit fields: the API never reports packets in transit',
    !('pendingSends' in crew.data.summary) &&
      !('nextVisibleAt' in crew.data.summary) &&
      !(card && 'pendingSends' in card),
    crew.data.summary,
  );
  check(
    'crew response carries cards only, no packet notes',
    !crew.text.includes('secret'),
    crew.text,
  );

  const dup = await call<PacketReceipt>('POST', '/api/packets', a);
  check(
    'idempotent: resending the same id → 200 duplicate, same receivedAt/visibleAt',
    dup.status === 200 &&
      dup.data.duplicate === true &&
      dup.data.visibleAt === post.data.visibleAt &&
      dup.data.receivedAt === post.data.receivedAt,
    dup,
  );

  const astro = await call<AstronautResponse>('GET', `/api/astronaut/tester-a?mission=${mission}`);
  check(
    'astronaut: one packet with notes, reading notes and series, no private gate',
    astro.data.packets.length === 1 &&
      astro.data.packets[0].notes === 'secret note' &&
      astro.data.packets[0].readings[0].note === 'secret reading note' &&
      !('accessLog' in astro.data) &&
      astro.data.series['heart-rate']?.length === 1,
    astro.data,
  );

  const old = new Date(Date.now() - 7 * 3600_000).toISOString();
  const b = packet(mission, 'tester-b', {
    createdAt: old,
    readings: [
      {
        id: `r-${crypto.randomUUID()}`,
        indicator: 'cabin-co2',
        value: 2.1,
        unit: 'mmHg',
        takenAt: old,
        source: 'ship',
        simulated: false,
        crewMember: 'tester-b',
        note: 'module:lab',
      },
    ],
  });
  await call('POST', '/api/packets', b);
  const telemetry = await call<AstronautResponse>(
    'GET',
    `/api/astronaut/tester-b?mission=${mission}`,
  );
  check(
    'ship telemetry notes (module:lab) are returned with the reading',
    telemetry.data.packets[0]?.readings[0]?.note === 'module:lab',
    telemetry.data.packets[0],
  );
  const after = await call<CrewResponse>('GET', `/api/crew?mission=${mission}`);
  const stale = after.data.crew.find((c) => c.id === 'tester-b');
  check(
    'crew member whose latest data is 7 h old → noRecentData (not green)',
    stale?.noRecentData === true && stale.lastDataAt === old,
    stale,
  );
  check(
    'mission auto-created from packets with both crew members',
    after.data.mission.code === mission && after.data.crew.length === 2,
    after.data.mission,
  );
}

async function testValidation() {
  const empty = await call<{ error: string; details: string[] }>('POST', '/api/packets', {});
  check(
    'POST {} → 400 with details',
    empty.status === 400 && empty.data.details.length > 0,
    empty.data,
  );
  const bad = await call('POST', '/api/packets', undefined, '{not json');
  check('POST invalid JSON → 400', bad.status === 400, bad);
  const missing = await call('GET', '/api/crew?mission=NOPE00');
  check('GET /api/crew unknown mission → 404', missing.status === 404, missing);
  const nobody = await call('GET', '/api/astronaut/nobody?mission=NOPE00');
  check('GET /api/astronaut unknown → 404', nobody.status === 404, nobody);
}

async function testMissionsAndRules() {
  const created = await call<StoredMission>('POST', '/api/missions', {
    name: 'Test mission',
    environment: 'mars',
    durationDays: 30,
    currentDelayMin: 11,
    crew: [{ id: 'tester-a', name: 'Tester A', hasWatch: false }],
  });
  if (created.data?.code) missionCodes.push(created.data.code);
  check(
    'POST /api/missions → 201 with a six-character code',
    created.status === 201 && /^[A-Z0-9]{6}$/.test(created.data.code) && created.data.day === 1,
    created.data,
  );
  const list = await call<{ missions: StoredMission[] }>('GET', '/api/missions');
  check(
    'GET /api/missions lists it',
    list.data.missions.some((m) => m.code === created.data.code),
  );
  const invalid = await call('POST', '/api/missions', { name: 'x', environment: 'pluto' });
  check('POST /api/missions invalid → 400', invalid.status === 400, invalid.data);

  const m = created.data.code;
  const version = await call<RulesVersion>('POST', `/api/rules?mission=${m}`, {
    config: { version: 'test-1' },
    note: 'glucose threshold',
  });
  check(
    'POST /api/rules → 201, status "sent", not received yet',
    version.status === 201 &&
      version.data.status === 'sent' &&
      version.data.receivedAt === null &&
      version.data.version === 'test-1' &&
      !('visibleAt' in version.data),
    version.data,
  );
  const anonymous = await call<{ versions: RulesVersion[] }>('GET', `/api/rules?mission=${m}`);
  const intruder = await call<{ versions: RulesVersion[] }>(
    'GET',
    `/api/rules?mission=${m}&crewMember=not-in-crew`,
  );
  const untouched = intruder.data.versions.find((v) => v.id === version.data.id);
  check(
    'downloads without crewMember or by someone outside the crew do not mark it received',
    anonymous.status === 200 &&
      untouched?.status === 'sent' &&
      untouched.receivedAt === null &&
      untouched.receivedBy.length === 0,
    untouched,
  );
  const download = await call<{ versions: RulesVersion[] }>(
    'GET',
    `/api/rules?mission=${m}&crewMember=tester-a`,
  );
  const received = download.data.versions.find((v) => v.id === version.data.id);
  check(
    'a phone download (GET /api/rules) marks it "received" with who and when',
    received?.status === 'received' &&
      received.receivedAt !== null &&
      received.receivedBy.some((r) => r.crewMember === 'tester-a'),
    received,
  );
  const applied = await call<RulesVersion>('POST', `/api/rules?mission=${m}`, {
    apply: version.data.id,
    crewMember: 'tester-a',
  });
  check(
    'POST { apply } marks it "applied"',
    applied.status === 200 &&
      applied.data.status === 'applied' &&
      applied.data.appliedBy.length === 1,
    applied.data,
  );
  const direct = await call<RulesVersion>('POST', `/api/rules?mission=${m}`, {
    config: { version: 'test-2' },
  });
  const directApply = await call<RulesVersion>('POST', `/api/rules?mission=${m}`, {
    apply: direct.data.id,
  });
  check(
    'applying without a recorded download is accepted (no 409) and also sets receivedAt',
    directApply.status === 200 &&
      directApply.data.status === 'applied' &&
      directApply.data.receivedAt !== null,
    directApply.data,
  );
}

async function testSeed() {
  const res = await call<CrewResponse>('GET', '/api/crew?mission=ARES01');
  if (res.status === 404) {
    console.log('- ARES01 not seeded: skipping seed checks (pnpm --filter web seed)');
    return;
  }
  const byId = Object.fromEntries(res.data.crew.map((c) => [c.id, c]));
  check(
    'seed: three astronauts, Samira Chen without recent data, the others with data',
    res.data.crew.length === 3 &&
      byId['samira-chen']?.noRecentData === true &&
      byId['elena-vega']?.noRecentData === false &&
      byId['mateo-rios']?.noRecentData === false,
    res.data.crew.map((c) => ({
      id: c.id,
      noRecentData: c.noRecentData,
      lastDataAt: c.lastDataAt,
    })),
  );
  check(
    'seed: the three astronauts wear a watch (their records include watch readings)',
    res.data.crew.every((c) => c.hasWatch === true),
    res.data.crew.map((c) => ({ id: c.id, hasWatch: c.hasWatch })),
  );
  check(
    "seed: Mateo Ríos's latest visible packet is the emergency",
    byId['mateo-rios']?.lastPacket?.type === 'emergency',
    byId['mateo-rios']?.lastPacket,
  );
  check(
    'seed: nothing in transit and no "simulated" records',
    !('pendingSends' in res.data.summary) &&
      !/simulat|demo/i.test(res.text.replace(/"simulated":false/g, '')),
    res.data.summary,
  );
  const mateo = await call<AstronautResponse>('GET', '/api/astronaut/mateo-rios?mission=ARES01');
  check(
    'seed: astronaut detail never says simulated/demo and every record has simulated=false',
    !/simulat|demo/i.test(mateo.text.replace(/"simulated":false/g, '')) &&
      mateo.data.packets.every((p) => p.readings.every((r) => r.simulated === false)),
    mateo.text.match(/.{40}(simulat|demo).{40}/i)?.[0],
  );
  check(
    'seed: astronaut detail has packets and the emergency with ECG',
    mateo.data.packets.some((p) => p.type === 'emergency' && (p.ecg?.microvolts.length ?? 0) > 0),
    mateo.data.packets.map((p) => p.type),
  );
}

async function cleanup() {
  const client = await new MongoClient(mongoUri()).connect();
  try {
    const db = client.db(mongoDbName());
    await Promise.all([
      db.collection(COLLECTIONS.packets).deleteMany({ mission: { $in: missionCodes } }),
      db.collection(COLLECTIONS.missions).deleteMany({ code: { $in: missionCodes } }),
      db.collection(COLLECTIONS.rules).deleteMany({ mission: { $in: missionCodes } }),
    ]);
  } finally {
    await client.close();
  }
}

try {
  await testCors();
  await testValidation();
  await testInstantAndIdempotency();
  await testMissionsAndRules();
  await testSeed();
} catch (error) {
  check('unexpected error', false, (error as Error).stack);
} finally {
  await cleanup();
}
const failed = results.filter((r) => !r.ok);
console.log(`\n${results.length - failed.length}/${results.length} checks passed`);
process.exit(failed.length ? 1 : 0);
