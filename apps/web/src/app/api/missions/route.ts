import { createMission, listMissions } from '@/features/extras/server';
import { error, handle, json, preflight, readJson } from '@/server/http';

export async function GET() {
  return handle(async () => json(await listMissions()));
}

export async function POST(request: Request) {
  return handle(async () => {
    const body = await readJson(request);
    if (body === undefined) return error(400, 'Body must be valid JSON');
    const result = await createMission(body);
    return result.ok
      ? json(result.data, result.status)
      : error(result.status, result.error, result.details);
  });
}

export function OPTIONS() {
  return preflight();
}
