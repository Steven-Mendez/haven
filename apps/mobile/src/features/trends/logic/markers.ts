import type { Mission } from '@haven/core';

export type MarkerKind = 'emergency' | 'environment';

export type TrendMarker = {
  id: string;
  t: number;
  kind: MarkerKind;
  ref: string;
  packet?: string;
};

export const SAME_EMERGENCY_MS = 2 * 3_600_000;

export function markerId(kind: MarkerKind, t: number, ref: string): string {
  return `${kind}:${t}:${ref}`;
}

export function markersFromMissionChange(
  previous: Pick<Mission, 'environment'> | undefined,
  next: Pick<Mission, 'environment'>,
  t: number,
): TrendMarker[] {
  if (!previous || next.environment === previous.environment) return [];
  return [
    {
      id: markerId('environment', t, next.environment),
      t,
      kind: 'environment',
      ref: next.environment,
    },
  ];
}

export function markerForClosedEmergency(
  markers: TrendMarker[],
  t: number,
  packetId?: string,
): TrendMarker | undefined {
  if (packetId) {
    const existing = markers.find((m) => m.kind === 'emergency' && m.packet === packetId);
    if (existing) return existing.t === t ? undefined : { ...existing, t };
  }
  const opened = [...markers]
    .reverse()
    .find((m) => m.kind === 'emergency' && !m.packet && m.t <= t && t - m.t <= SAME_EMERGENCY_MS);
  if (opened) return packetId ? { ...opened, packet: packetId } : undefined;
  return {
    id: packetId ? `emergency:packet:${packetId}` : markerId('emergency', t, 'close'),
    t,
    kind: 'emergency',
    ref: 'close',
    packet: packetId,
  };
}

export function markersInWindow(
  markers: TrendMarker[],
  window: [number, number],
  max = 6,
  minGapFraction = 0.12,
): TrendMarker[] {
  const [from, to] = window;
  const minGap = (to - from) * minGapFraction;
  const sorted = markers.filter((m) => m.t >= from && m.t <= to).sort((a, b) => a.t - b.t);
  const inside: TrendMarker[] = [];
  for (const m of sorted) {
    const previous = inside[inside.length - 1];
    if (previous && m.t - previous.t < minGap) {
      if (previous.kind !== 'emergency' || m.kind === 'emergency') inside[inside.length - 1] = m;
      continue;
    }
    inside.push(m);
  }
  if (inside.length <= max) return inside;
  const emergencies = inside.filter((m) => m.kind === 'emergency').slice(-max);
  const others = inside.filter((m) => m.kind !== 'emergency').slice(-(max - emergencies.length));
  return [...emergencies, ...others].sort((a, b) => a.t - b.t);
}
