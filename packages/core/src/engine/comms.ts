import type { CommsConfig } from '../contracts';
import { MIN_MS } from './util';

/**
 * realtime: a conversation still feels live (Moon); delayed: messages take
 * minutes but Earth can guide; autonomous: the crew acts on its own and Earth
 * supports later (Mars); offline: no link at all.
 */
export type CommsMode = 'realtime' | 'delayed' | 'autonomous' | 'offline';

export function commsMode(
  link: { currentDelayMin: number; linkDown: boolean },
  cfg: CommsConfig,
): CommsMode {
  if (link.linkDown) return 'offline';
  if (link.currentDelayMin <= cfg.realtimeMaxMin) return 'realtime';
  if (link.currentDelayMin >= cfg.autonomousFromMin) return 'autonomous';
  return 'delayed';
}

/**
 * When something sent at `at` reaches the other side, and the earliest a reply
 * can come back (one round trip, without counting the time to answer).
 */
export function linkTimes(at: Date, delayMin: number): { arrivesAt: string; replyAt: string } {
  const oneWay = Math.max(0, delayMin) * MIN_MS;
  return {
    arrivesAt: new Date(at.getTime() + oneWay).toISOString(),
    replyAt: new Date(at.getTime() + 2 * oneWay).toISOString(),
  };
}

/** The crew should not wait for Earth during an emergency. */
export const actsAlone = (mode: CommsMode) => mode === 'autonomous' || mode === 'offline';
