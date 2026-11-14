// Shared contracts §8 · Internal mobile events.

import type { Assessment } from './assessment';
import type { Mission, Packet } from './packet';
import type { Reading } from './reading';
import type { WatchMessages } from './watch';

export type HavenEvents = {
  'reading:new': Reading;
  'assessments:changed': Assessment[];
  'emergency:open': {
    origin: WatchMessages['emergency']['origin'] | 'notification' | 'assessment';
  };
  'emergency:close': { packet: Packet };
  /** Ask M09 to compose and enqueue a packet (routine export from M04, cognitive alert from M10). */
  'packet:enqueue': { packet: Packet };
  'packet:queued': Packet;
  'mission:changed': Mission;
  /** All local data was wiped (dev tools «Borrar datos»): features drop their in-memory caches. */
  'data:reset': Record<string, never>;
};
