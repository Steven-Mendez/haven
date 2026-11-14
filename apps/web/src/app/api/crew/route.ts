import type { NextRequest } from 'next/server';
import { getCrew, recordCrewSession } from '@/features/crew/server';
import { error, handle, json, preflight, readJson } from '@/server/http';
import { DEFAULT_MISSION } from '@/server/types';

export async function GET(request: NextRequest) {
  return handle(async () => {
    const mission = request.nextUrl.searchParams.get('mission') || DEFAULT_MISSION;
    const crew = await getCrew(mission);
    return crew ? json(crew) : error(404, `Mission ${mission} does not exist`);
  });
}

export async function POST(request: Request) {
  return handle(async () => {
    const body = await readJson(request);
    if (body === undefined) return error(400, 'Body must be valid JSON');
    const result = await recordCrewSession(body);
    return result.ok
      ? json(result.data, result.status)
      : error(result.status, result.error, result.details);
  });
}

export function OPTIONS() {
  return preflight();
}
