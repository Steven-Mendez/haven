// Contract C · native module HavenWatch (W00), WatchConnectivity bridge with the Apple Watch.
// Consumed by `@/shared/watch`. It only exists on iOS; elsewhere `HavenWatch` is null.
import type { ReachabilityChangeEvent, WatchEnvelope } from './src/HavenWatch.types';
import HavenWatch from './src/HavenWatchModule';

export type {
  HavenWatchEvents,
  MessageEvent,
  ReachabilityChangeEvent,
} from './src/HavenWatch.types';
export type { HavenWatchModule } from './src/HavenWatchModule';
/** Raw module (exact contract C API) or null when it is not compiled for this platform. */
export { HavenWatch };

/** true when the native module is compiled into this app (iOS after prebuild). */
export const hasNativeModule = HavenWatch != null;

/** WCSession supported and activated. */
export function isAvailable(): boolean {
  return HavenWatch?.isAvailable() ?? false;
}

/** A paired watch has the HAVEN app installed. */
export function isPaired(): boolean {
  return HavenWatch?.isPaired() ?? false;
}

/** The watch app is open and receives messages immediately. */
export function isReachable(): boolean {
  return HavenWatch?.isReachable() ?? false;
}

/** Sends an envelope to the watch. Returns false when there is no native module. */
export function send(envelope: WatchEnvelope): boolean {
  if (!HavenWatch) return false;
  HavenWatch.send(JSON.stringify(envelope));
  return true;
}

/**
 * Emergency started on the phone (not by the watch): wakes the watch app and opens its patient monitor.
 * Resolves false without the native module, HealthKit or the watch app.
 */
export async function startWatchMonitor(): Promise<boolean> {
  if (!HavenWatch) return false;
  try {
    return await HavenWatch.startWatchMonitor();
  } catch (error) {
    console.warn('[haven-watch] startWatchMonitor failed', error);
    return false;
  }
}

/**
 * Listens to envelopes coming from the watch. Invalid JSON is dropped with a warning.
 * Returns the unsubscribe function.
 */
export function listen(cb: (envelope: WatchEnvelope) => void): () => void {
  if (!HavenWatch) return () => {};
  const sub = HavenWatch.addListener('onMessage', ({ json }) => {
    try {
      cb(JSON.parse(json) as WatchEnvelope);
    } catch (error) {
      console.warn('[haven-watch] invalid envelope', json, error);
    }
  });
  return () => sub.remove();
}

/** Listens to reachability changes (watch app open or not). */
export function listenReachability(cb: (event: ReachabilityChangeEvent) => void): () => void {
  if (!HavenWatch) return () => {};
  const sub = HavenWatch.addListener('onReachabilityChange', cb);
  return () => sub.remove();
}
