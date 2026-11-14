import 'server-only';
import { connection } from 'next/server';
import { getAstronaut as queryAstronaut } from '@/server/queries';
import { type AstronautResponse, DEFAULT_MISSION } from '@/server/types';

// T02 · Server data access for the astronaut detail. Same shape as GET /api/astronaut/[id].
// Types for views: import type { AstronautResponse, ReceivedPacket } from '@/server/types'.

/**
 * One crew member with every received packet, notes and diary included.
 * `null` if the mission or the crew member does not exist.
 */
export async function getAstronaut(
  crewMember: string,
  mission = DEFAULT_MISSION,
): Promise<AstronautResponse | null> {
  await connection();
  return queryAstronaut(mission, crewMember);
}
