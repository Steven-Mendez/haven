import type { HavenEvents } from '@haven/core';

type Name = keyof HavenEvents;
type Listener<N extends Name> = (payload: HavenEvents[N]) => void;

const listeners = new Map<Name, Set<Listener<Name>>>();

export const bus = {
  emit<N extends Name>(name: N, payload: HavenEvents[N]) {
    for (const listener of [...(listeners.get(name) ?? [])]) {
      try {
        (listener as Listener<N>)(payload);
      } catch (error) {
        console.error(`[bus] listener for '${name}' failed`, error);
      }
    }
  },
  on<N extends Name>(name: N, listener: Listener<N>): () => void {
    const set = listeners.get(name) ?? new Set();
    set.add(listener as Listener<Name>);
    listeners.set(name, set);
    return () => set.delete(listener as Listener<Name>);
  },
};
