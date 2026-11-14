import type { HavenEvents } from '@haven/core';
import { useEffect, useRef } from 'react';
import { bus } from './bus';

/** Listens to a bus event while the component is mounted. */
export function useEvent<N extends keyof HavenEvents>(
  name: N,
  listener: (payload: HavenEvents[N]) => void,
) {
  const ref = useRef(listener);
  ref.current = listener;
  useEffect(() => bus.on(name, (payload) => ref.current(payload)), [name]);
}
