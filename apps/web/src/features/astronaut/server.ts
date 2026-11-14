import 'server-only';
import { connection } from 'next/server';
import { getAstronaut as queryAstronaut } from '@/server/queries';
import { type AstronautResponse, DEFAULT_MISSION } from '@/server/types';

export async function getAstronaut(
  crewMember: string,
  mission = DEFAULT_MISSION,
): Promise<AstronautResponse | null> {
  await connection();
  return queryAstronaut(mission, crewMember);
}
