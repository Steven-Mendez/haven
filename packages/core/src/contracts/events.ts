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
  'emergency:update': { packet: Packet };
  'emergency:close': { packet: Packet };
  'packet:enqueue': { packet: Packet };
  'packet:queued': Packet;
  'mission:changed': Mission;
  'data:reset': Record<string, never>;
  'session:signout': Record<string, never>;
};
