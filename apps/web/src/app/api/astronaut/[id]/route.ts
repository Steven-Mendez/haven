import type { NextRequest } from 'next/server';
import { getAstronaut } from '@/features/astronaut/server';
import { error, handle, json, preflight } from '@/server/http';
import { DEFAULT_MISSION } from '@/server/types';

/** GET /api/astronaut/[id]?mission=CODE · every received packet as sent, notes and diary included. */
export async function GET(request: NextRequest, ctx: RouteContext<'/api/astronaut/[id]'>) {
  return handle(async () => {
    const { id } = await ctx.params;
    const query = request.nextUrl.searchParams;
    const mission = query.get('mission') || DEFAULT_MISSION;
    const result = await getAstronaut(id, mission);
    return result ? json(result) : error(404, `Crew member ${id} not found in mission ${mission}`);
  });
}

export function OPTIONS() {
  return preflight();
}
