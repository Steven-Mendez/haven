import type { WatchEnvelope } from '@haven/core';

export type { WatchEnvelope };

export type MessageEvent = {
  json: string;
};

export type ReachabilityChangeEvent = {
  reachable: boolean;
};

export type HavenWatchEvents = {
  onMessage: (event: MessageEvent) => void;
  onReachabilityChange: (event: ReachabilityChangeEvent) => void;
};
