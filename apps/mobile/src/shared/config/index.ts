import { type Config, loadConfig, rebaseConfig } from '@haven/core';
import { useSyncExternalStore } from 'react';

const base: Config = loadConfig();
let active: Config = base;
const listeners = new Set<(config: Config) => void>();

export const config: Config = new Proxy({} as Config, {
  get: (_target, key) => Reflect.get(active, key),
  has: (_target, key) => Reflect.has(active, key),
  ownKeys: () => Reflect.ownKeys(active),
  getOwnPropertyDescriptor: (_target, key) => {
    const descriptor = Reflect.getOwnPropertyDescriptor(active, key);
    return descriptor ? { ...descriptor, configurable: true } : undefined;
  },
});

export const baseConfig: Config = base;

export function activeConfig(): Config {
  return active;
}

export function setActiveConfig(next: Config | null): void {
  const value = next ? rebaseConfig(base, next) : base;
  if (value === active) return;
  active = value;
  for (const listener of [...listeners]) listener(active);
}

export function onConfigChange(listener: (config: Config) => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function useConfig(): Config {
  return useSyncExternalStore(onConfigChange, activeConfig, activeConfig);
}
