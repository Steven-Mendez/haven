import 'server-only';
import { networkInterfaces } from 'node:os';
import { headers } from 'next/headers';
import { connection } from 'next/server';
import QRCode from 'qrcode';
import {
  type CrewInput,
  addCrewMember as queryAddCrewMember,
  getCrew as queryCrew,
  receivePacket as queryReceivePacket,
  recordCrewSession as queryRecordCrewSession,
  removeCrewMember as queryRemoveCrewMember,
  startMission as queryStartMission,
  updateCrewMember as queryUpdateCrewMember,
} from '@/server/queries';
import { type CrewResponse, DEFAULT_MISSION } from '@/server/types';

export async function getCrew(mission = DEFAULT_MISSION): Promise<CrewResponse | null> {
  await connection();
  return queryCrew(mission);
}

export async function receivePacket(body: unknown) {
  await connection();
  return queryReceivePacket(body);
}

export async function addCrewMember(mission: string, input: CrewInput) {
  await connection();
  return queryAddCrewMember(mission, input);
}

export async function updateCrewMember(mission: string, id: string, input: CrewInput) {
  await connection();
  return queryUpdateCrewMember(mission, id, input);
}

export async function removeCrewMember(mission: string, id: string) {
  await connection();
  return queryRemoveCrewMember(mission, id);
}

export async function earthUrlForPhones(): Promise<string> {
  const fixed = process.env.HAVEN_PUBLIC_URL?.trim();
  if (fixed) return fixed.replace(/\/+$/, '');
  const head = await headers();
  const host = head.get('x-forwarded-host') ?? head.get('host') ?? 'localhost:3000';
  const proto = head.get('x-forwarded-proto') ?? 'http';
  const [name, port] = host.split(':');
  if (!LOOPBACK.has(name)) return `${proto}://${host}`;
  const lan = Object.values(networkInterfaces())
    .flat()
    .find((i) => i && i.family === 'IPv4' && !i.internal)?.address;
  return `${proto}://${lan ?? name}${port ? `:${port}` : ''}`;
}

const LOOPBACK = new Set(['localhost', '127.0.0.1', '[::1]']);

export function joinLink(mission: string, crewMember: string, api: string): string {
  const query = new URLSearchParams({ mission, crew: crewMember, api });
  return `haven://join?${query}`;
}

export function joinQrSvg(link: string): Promise<string> {
  return QRCode.toString(link, {
    type: 'svg',
    errorCorrectionLevel: 'M',
    margin: 2,
    color: { dark: '#000000', light: '#ffffff' },
  });
}

export async function startMission(mission: string) {
  await connection();
  return queryStartMission(mission);
}

export async function recordCrewSession(body: unknown) {
  await connection();
  return queryRecordCrewSession(body);
}
