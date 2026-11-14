// Puente con el Apple Watch (solo iOS). Desde la app, usar `@/lib/watch`.
import { WATCH_STATE_TYPES, type WatchEnvelope } from '@haven/shared';
import HavenWatch from './src/HavenWatchModule';

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

/** Manda un sobre al reloj. Los tipos de estado además se guardan en el applicationContext. */
export function send(envelope: WatchEnvelope): boolean {
  if (!HavenWatch) return false;
  const json = JSON.stringify(envelope);
  if (WATCH_STATE_TYPES.includes(envelope.type)) HavenWatch.updateContext(json);
  HavenWatch.send(json);
  return true;
}

/** Escucha sobres del reloj. Devuelve la función para dejar de escuchar. */
export function listen(cb: (envelope: WatchEnvelope) => void): () => void {
  if (!HavenWatch) return () => {};
  const sub = HavenWatch.addListener('onMessage', ({ json }) => {
    try {
      cb(JSON.parse(json) as WatchEnvelope);
    } catch (error) {
      console.warn('[haven-watch] sobre inválido', json, error);
    }
  });
  return () => sub.remove();
}

export function listenReachability(cb: (reachable: boolean) => void): () => void {
  if (!HavenWatch) return () => {};
  const sub = HavenWatch.addListener('onReachabilityChange', ({ reachable }) => cb(reachable));
  return () => sub.remove();
}
