// Event markers for Trends charts (emergencies and environment changes).
// Pure: only `@haven/core` and relative modules.

import type { Mission } from '@haven/core';

export type MarkerKind = 'emergency' | 'environment';

export type TrendMarker = {
  id: string;
  /** Epoch ms. */
  t: number;
  kind: MarkerKind;
  /** Environment id or emergency origin. */
  ref: string;
  /** Emergency packet id (`emergency:close`): one marker per packet. */
  packet?: string;
};

/** An `emergency:close` within this window after an `emergency:open` is the same emergency. */
export const SAME_EMERGENCY_MS = 2 * 3_600_000;

export function markerId(kind: MarkerKind, t: number, ref: string): string {
  return `${kind}:${t}:${ref}`;
}

/** Marker produced by a mission change: the new environment. */
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

/**
 * Marker for a closed emergency, unique per `packet.id` (Fénix may re-emit `emergency:close` with
 * the same packet after adding a note). Returns the marker to upsert, or `undefined` if nothing
 * changes:
 * - a marker for this packet already exists → that marker (same id, time updated);
 * - an emergency opened in the preceding `SAME_EMERGENCY_MS` without a packet yet → that marker,
 *   now linked to the packet (no duplicate);
 * - otherwise a new marker whose id is derived from the packet id.
 */
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

/**
 * Markers inside `[from, to]`, sorted, at most `max` (keeps the latest; emergencies first).
 * Markers closer than `minGapFraction` of the window collapse into one so labels never overlap:
 * an emergency wins, otherwise the latest.
 */
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
