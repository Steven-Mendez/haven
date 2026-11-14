import { type Config, loadConfig } from '@haven/core';
import { useSyncExternalStore } from 'react';

// Versioned configuration (thresholds, texts, protocols). Never hard-coded in a feature.
//
// `config` is live: it always reads the active config, which is the bundled one or the rules
// received from Earth (M05 calls `setActiveConfig`). It stays importable as a constant
// (`config.indicators`, `config.zones`…), so existing features keep working. To re-render when the
// rules change, read it through `useConfig()`; `@/shared/data` re-evaluates on every change.

const base: Config = loadConfig();
let active: Config = base;
const listeners = new Set<(config: Config) => void>();

/** Live view of the active config (a Proxy: never cache its arrays across a rules change). */
export const config: Config = new Proxy({} as Config, {
  get: (_target, key) => Reflect.get(active, key),
  has: (_target, key) => Reflect.has(active, key),
  ownKeys: () => Reflect.ownKeys(active),
  getOwnPropertyDescriptor: (_target, key) => {
    const descriptor = Reflect.getOwnPropertyDescriptor(active, key);
    return descriptor ? { ...descriptor, configurable: true } : undefined;
  },
});

/** The bundled config (`loadConfig()`), whatever is active. */
export const baseConfig: Config = base;

/** The active config object (a plain object, e.g. to pass to `@haven/core` functions). */
export function activeConfig(): Config {
  return active;
}

/** Activates a config received from Earth, or `null` to go back to the bundled one. */
export function setActiveConfig(next: Config | null): void {
  const value = next ?? base;
  if (value === active) return;
  active = value;
  for (const listener of [...listeners]) listener(active);
}

/** Listens to active config changes. Returns the unsubscribe function. */
export function onConfigChange(listener: (config: Config) => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/** Active config; re-renders when the rules change. */
export function useConfig(): Config {
  return useSyncExternalStore(onConfigChange, activeConfig, activeConfig);
}
