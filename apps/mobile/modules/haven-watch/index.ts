import type { ReachabilityChangeEvent, WatchEnvelope } from './src/HavenWatch.types';
import HavenWatch from './src/HavenWatchModule';

export type {
  HavenWatchEvents,
  MessageEvent,
  ReachabilityChangeEvent,
} from './src/HavenWatch.types';
export type { HavenWatchModule } from './src/HavenWatchModule';
export { HavenWatch };

export const hasNativeModule = HavenWatch != null;

export function isAvailable(): boolean {
  return HavenWatch?.isAvailable() ?? false;
}

export function isPaired(): boolean {
  return HavenWatch?.isPaired() ?? false;
}

export function isReachable(): boolean {
  return HavenWatch?.isReachable() ?? false;
}

export function send(envelope: WatchEnvelope): boolean {
  if (!HavenWatch) return false;
  HavenWatch.send(JSON.stringify(envelope));
  return true;
}

export async function startWatchMonitor(): Promise<boolean> {
  if (!HavenWatch) return false;
  try {
    return await HavenWatch.startWatchMonitor();
  } catch (error) {
    console.warn('[haven-watch] startWatchMonitor failed', error);
    return false;
  }
}

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

export function listenReachability(cb: (event: ReachabilityChangeEvent) => void): () => void {
  if (!HavenWatch) return () => {};
  const sub = HavenWatch.addListener('onReachabilityChange', cb);
  return () => sub.remove();
}
