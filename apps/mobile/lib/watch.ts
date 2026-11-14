// Hooks del puente con el Apple Watch. No-op en Android y web.
import { type WatchEnvelope, type WatchMessages, type WatchMessageType, envelope } from '@haven/shared';
import * as React from 'react';
import * as HavenWatch from '@/modules/haven-watch';

export function sendToWatch<T extends WatchMessageType>(type: T, payload: WatchMessages[T]): boolean {
  return HavenWatch.send(envelope(type, payload));
}

/** Escucha los sobres del reloj mientras el componente está montado. */
export function useWatchMessages(onMessage: (envelope: WatchEnvelope) => void) {
  const ref = React.useRef(onMessage);
  React.useEffect(() => {
    ref.current = onMessage;
  });
  React.useEffect(() => HavenWatch.listen((e) => ref.current(e)), []);
}

/** true mientras la app del reloj está abierta. */
export function useWatchReachable(): boolean {
  const [reachable, setReachable] = React.useState(HavenWatch.isReachable);
  React.useEffect(() => HavenWatch.listenReachability(setReachable), []);
  return reachable;
}
