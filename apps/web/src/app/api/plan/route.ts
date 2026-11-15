import type { NextRequest } from 'next/server';
import { error, handle, json, preflight } from '@/server/http';
import { getPlan } from '@/server/queries';

const CODE = /^[A-Z0-9]{6}$/;
const CREW = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

/** The plan Earth assigned to a crew member; an empty one if there is none yet. */
export async function GET(request: NextRequest) {
  return handle(async () => {
    const query = request.nextUrl.searchParams;
    const mission = (query.get('mission') ?? '').toUpperCase();
    const crewMember = query.get('crewMember') ?? '';
    if (!CODE.test(mission) || !CREW.test(crewMember) || crewMember.length > 60)
      return error(400, 'mission and crewMember are required');
    return json(await getPlan(mission, crewMember));
  });
}

export function OPTIONS() {
  return preflight();
}
