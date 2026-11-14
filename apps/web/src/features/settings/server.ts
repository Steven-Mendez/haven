import 'server-only';
import { connection } from 'next/server';
import { listMissions as queryListMissions } from '@/server/queries';
import type { StoredMission } from '@/server/types';

/** Missions registered on Earth (newest first), or `null` when the database does not answer. */
export async function readMissions(): Promise<StoredMission[] | null> {
  await connection();
  try {
    return (await queryListMissions()).missions;
  } catch {
    return null;
  }
}
