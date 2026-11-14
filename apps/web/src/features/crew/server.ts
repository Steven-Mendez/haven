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
  removeCrewMember as queryRemoveCrewMember,
  startMission as queryStartMission,
  updateCrewMember as queryUpdateCrewMember,
} from '@/server/queries';
import { type CrewResponse, DEFAULT_MISSION } from '@/server/types';

// T01 · Server data access for the crew view and the API routes. Same shapes as the API.
// Types for views: import type { CrewResponse, CrewCard } from '@/server/types'.

/** Crew of a mission with ONLY visible packets (`visibleAt <= now`); `null` if the mission does not exist. */
export async function getCrew(mission = DEFAULT_MISSION): Promise<CrewResponse | null> {
  await connection();
  return queryCrew(mission);
}

/** Stores a packet from the phone (POST /api/packets). */
export async function receivePacket(body: unknown) {
  await connection();
  return queryReceivePacket(body);
}

/** Adds an astronaut to the roster from Earth, before their phone sends anything. */
export async function addCrewMember(mission: string, input: CrewInput) {
  await connection();
  return queryAddCrewMember(mission, input);
}

/** Changes the name or role shown on Earth. */
export async function updateCrewMember(mission: string, id: string, input: CrewInput) {
  await connection();
  return queryUpdateCrewMember(mission, id, input);
}

/** Deletes an astronaut and every packet they sent. */
export async function removeCrewMember(mission: string, id: string) {
  await connection();
  return queryRemoveCrewMember(mission, id);
}

/**
 * Earth address a phone on the same network can reach. `HAVEN_PUBLIC_URL` wins; otherwise the page's own host,
 * unless it is `localhost` (the operator's browser), then this machine's first LAN IPv4 on the same port.
 */
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

/** The link a phone opens to join `mission` as `crewMember`, talking to Earth at `api`. */
export function joinLink(mission: string, crewMember: string, api: string): string {
  const query = new URLSearchParams({ mission, crew: crewMember, api });
  return `haven://join?${query}`;
}

/** QR of a join link as an inline SVG (black on white, so any phone camera reads it in any theme). */
export function joinQrSvg(link: string): Promise<string> {
  return QRCode.toString(link, {
    type: 'svg',
    errorCorrectionLevel: 'M',
    margin: 2,
    color: { dark: '#000000', light: '#ffffff' },
  });
}

/** «Start mission»: day 1 is today and days start to run. */
export async function startMission(mission: string) {
  await connection();
  return queryStartMission(mission);
}
