import type { NextRequest } from 'next/server';
import { getAggregates } from '@/features/extras/server';
import { error, handle, json, preflight } from '@/server/http';
import { DEFAULT_MISSION } from '@/server/types';

export async function GET(request: NextRequest) {
  return handle(async () => {
    const query = request.nextUrl.searchParams;
    const mission = query.get('mission') || DEFAULT_MISSION;
    const indicators = (query.get('indicators') ?? '')
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean)
      .slice(0, 30);
    if (indicators.length === 0) return error(400, 'indicators: comma-separated ids required');
    return json(await getAggregates(indicators, mission));
  });
}

export function OPTIONS() {
  return preflight();
}
