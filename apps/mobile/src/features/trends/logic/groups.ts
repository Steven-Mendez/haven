import type { Level } from '@haven/core';

// List view of Trends (M04): a level summary on top (counts per level) and the rows grouped by
// body zone, worst zone first. Pure: only `@haven/core` types.

const SEVERITY: Record<Level, number> = { red: 0, amber: 1, pending: 2, green: 3 };
export const LEVEL_ORDER: Level[] = ['red', 'amber', 'green', 'pending'];

export type LevelCounts = Record<Level, number>;

export function levelCounts(levels: Level[]): LevelCounts {
  const counts: LevelCounts = { red: 0, amber: 0, green: 0, pending: 0 };
  for (const level of levels) counts[level] += 1;
  return counts;
}

export type ZoneGroup<T> = { zone: string; items: T[] };

/**
 * Groups items by zone. Inside a zone, worst level first and input order as tie-break; zones are
 * ordered by their worst item, then by `zoneOrder` (config order). Zones without items are left out.
 */
export function groupByZone<T extends { id: string; zone: string }>(
  items: T[],
  levelOf: (id: string) => Level,
  zoneOrder: string[],
): ZoneGroup<T>[] {
  const byZone = new Map<string, T[]>();
  for (const item of items) byZone.set(item.zone, [...(byZone.get(item.zone) ?? []), item]);
  const rank = (zone: string) => {
    const i = zoneOrder.indexOf(zone);
    return i === -1 ? zoneOrder.length : i;
  };
  const worst = (list: T[]) => Math.min(...list.map((i) => SEVERITY[levelOf(i.id)]));
  return [...byZone.entries()]
    .map(([zone, list]) => ({
      zone,
      items: list
        .map((item, order) => ({ item, order }))
        .sort(
          (a, b) =>
            SEVERITY[levelOf(a.item.id)] - SEVERITY[levelOf(b.item.id)] || a.order - b.order,
        )
        .map(({ item }) => item),
    }))
    .sort((a, b) => worst(a.items) - worst(b.items) || rank(a.zone) - rank(b.zone));
}
