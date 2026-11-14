// Which emergency the screen is showing (M06). Pure: no React, no @/shared.
//
// A new 'emergency:open' while the current emergency is still in progress is the same emergency
// (the origin is updated). Once its packet was sent, a new 'emergency:open' starts a NEW emergency:
// new protocol run, new packet id, new origin (QA Castor: watch SOS → End → watch spo2 trigger).

import type { EmergencyOrigin } from './packet';

export type Episode = {
  /** Increments with every new emergency; the screen keys its state on it. */
  number: number;
  origin: EmergencyOrigin;
  /** The packet of this emergency already went to the queue. */
  packetSent: boolean;
};

export function firstEpisode(origin: EmergencyOrigin): Episode {
  return { number: 1, origin, packetSent: false };
}

export function onEmergencyOpen(current: Episode, origin: EmergencyOrigin): Episode {
  if (current.packetSent) return { number: current.number + 1, origin, packetSent: false };
  return current.origin === origin ? current : { ...current, origin };
}

export function markPacketSent(current: Episode): Episode {
  return current.packetSent ? current : { ...current, packetSent: true };
}
