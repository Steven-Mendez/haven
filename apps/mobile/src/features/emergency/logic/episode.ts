import type { EmergencyOrigin } from './packet';

export type Episode = {
  number: number;
  origin: EmergencyOrigin;
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
