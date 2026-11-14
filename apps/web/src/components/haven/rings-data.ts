import type { CrewCard, ReceivedPacket } from '@/server/types';

export type RingId = 'routine' | 'measurements' | 'wellbeing';
export type RingDatum = { id: RingId; value: number; total: number };

export const RING_ORDER: RingId[] = ['routine', 'measurements', 'wellbeing'];

export const WELLBEING_ZONE = 'mind';
const ZONES_TOTAL = 7;

export function crewRings(
  member: Pick<CrewCard, 'actionsDone' | 'actionsTotal' | 'zones' | 'dailyProgress'>,
): RingDatum[] {
  const zones = member.zones;
  const mind = member.dailyProgress?.find((z) => z.zone === WELLBEING_ZONE)?.progress ?? 0;
  return [
    {
      id: 'routine',
      value: member.actionsDone,
      total: member.actionsTotal || member.dailyProgress?.length || ZONES_TOTAL,
    },
    {
      id: 'measurements',
      value: zones.filter((z) => z.level !== 'pending').length,
      total: zones.length || ZONES_TOTAL,
    },
    { id: 'wellbeing', value: mind, total: 1 },
  ];
}

export type DayRings = { day: string; rings: RingDatum[]; today: boolean; empty: boolean };

export function weekRings(
  packets: ReceivedPacket[],
  zoneOf: (indicator: string) => string | undefined,
  now: string | number | Date,
): DayRings[] {
  const end = new Date(now);
  const days: DayRings[] = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date(Date.UTC(end.getUTCFullYear(), end.getUTCMonth(), end.getUTCDate() - i));
    const key = d.toISOString().slice(0, 10);
    const ofDay = packets
      .filter((p) => p.dataAt.slice(0, 10) === key)
      .sort((a, b) => Date.parse(b.dataAt) - Date.parse(a.dataAt));
    const progress = ofDay.find((p) => p.dailyProgress?.length)?.dailyProgress ?? null;
    const zones = new Set(
      ofDay.flatMap((p) =>
        p.assessments.filter((a) => a.level !== 'pending').map((a) => zoneOf(a.indicator)),
      ),
    );
    zones.delete(undefined);
    days.push({
      day: key,
      today: i === 0,
      empty: ofDay.length === 0,
      rings: [
        {
          id: 'routine',
          value: progress?.filter((z) => z.progress >= 1).length ?? 0,
          total: progress?.length || ZONES_TOTAL,
        },
        { id: 'measurements', value: zones.size, total: ZONES_TOTAL },
        {
          id: 'wellbeing',
          value: progress?.find((z) => z.zone === WELLBEING_ZONE)?.progress ?? 0,
          total: 1,
        },
      ],
    });
  }
  return days;
}

export function ringCount(ring: RingDatum): string {
  if (ring.total === 1 && ring.value > 0 && ring.value < 1)
    return `${Math.round(ring.value * 100)} %`;
  return `${Math.round(ring.value)}/${ring.total}`;
}
