import type { NextRequest } from 'next/server';
import { getCrew } from '@/features/crew/server';
import { error, handle, json, preflight } from '@/server/http';
import { DEFAULT_MISSION } from '@/server/types';

/** GET /api/crew?mission=CODE · crew cards built only from visible packets (visibleAt <= now). */
export async function GET(request: NextRequest) {
  return handle(async () => {
    const mission = request.nextUrl.searchParams.get('mission') || DEFAULT_MISSION;
    const crew = await getCrew(mission);
    return crew ? json(crew) : error(404, `Mission ${mission} does not exist`);
  });
}

export function OPTIONS() {
  return preflight();
}
