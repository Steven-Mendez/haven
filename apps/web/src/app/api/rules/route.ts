import type { NextRequest } from 'next/server';
import { downloadRules, saveRules } from '@/features/extras/server';
import { error, handle, json, preflight, readJson } from '@/server/http';
import { DEFAULT_MISSION } from '@/server/types';

export async function GET(request: NextRequest) {
  return handle(async () => {
    const query = request.nextUrl.searchParams;
    const mission = query.get('mission') || DEFAULT_MISSION;
    const downloadedBy =
      query.get('crewMember') || request.headers.get('x-haven-actor') || undefined;
    return json(await downloadRules(mission, downloadedBy));
  });
}

export async function POST(request: NextRequest) {
  return handle(async () => {
    const body = await readJson(request);
    if (body === undefined) return error(400, 'Body must be valid JSON');
    const mission = request.nextUrl.searchParams.get('mission') || DEFAULT_MISSION;
    const result = await saveRules(mission, body);
    return result.ok
      ? json(result.data, result.status)
      : error(result.status, result.error, result.details);
  });
}

export function OPTIONS() {
  return preflight();
}
