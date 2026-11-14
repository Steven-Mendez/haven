// Contract C · types of the HavenWatch native module.
import type { WatchEnvelope } from '@haven/core';

export type { WatchEnvelope };

export type MessageEvent = {
  /** WatchEnvelope received from the watch, serialized as JSON. */
  json: string;
};

export type ReachabilityChangeEvent = {
  reachable: boolean;
};

export type HavenWatchEvents = {
  onMessage: (event: MessageEvent) => void;
  onReachabilityChange: (event: ReachabilityChangeEvent) => void;
};
