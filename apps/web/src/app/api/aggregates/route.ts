import type { NextRequest } from 'next/server';
import { getAggregates } from '@/features/extras/server';
import { error, handle, json, preflight } from '@/server/http';
import { DEFAULT_MISSION } from '@/server/types';

/**
 * GET /api/aggregates?mission=CODE&indicators=a,b · daily crew mean per indicator from visible readings.
 * Each indicator is `null` only when nobody measured it: shown with any crew size (the earlier
 * 3-astronaut minimum of closed decision 4 was dropped, everything is shown).
 */
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
