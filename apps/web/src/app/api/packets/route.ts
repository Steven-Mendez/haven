import { receivePacket } from '@/features/crew/server';
import { error, handle, json, preflight, readJson } from '@/server/http';

export async function POST(request: Request) {
  return handle(async () => {
    const body = await readJson(request);
    if (body === undefined) return error(400, 'Body must be valid JSON');
    const result = await receivePacket(body);
    return result.ok
      ? json(result.data, result.status)
      : error(result.status, result.error, result.details);
  });
}

export function OPTIONS() {
  return preflight();
}
