import { connection } from 'next/server';
import { json, preflight } from '@/server/http';
import { getDb } from '@/server/mongodb';

/** GET /api/health · checks that the API answers and MongoDB is reachable. */
export async function GET() {
  await connection();
  try {
    await (await getDb()).command({ ping: 1 });
    return json({ ok: true, mongo: 'connected' });
  } catch (e) {
    return json({ ok: false, mongo: 'disconnected', error: (e as Error).message }, 503);
  }
}

export function OPTIONS() {
  return preflight();
}
