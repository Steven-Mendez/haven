import type { HealthProvider } from '@haven/core';

// Health source registry (contracts §3). M07 registers HealthKit, the pedometer, Health Connect and BLE.
// The engine never knows who answered.

const providers = new Map<string, HealthProvider>();

export function registerProvider(provider: HealthProvider) {
  providers.set(provider.id, provider);
}

export function unregisterProvider(id: string) {
  providers.delete(id);
}

export function registeredProviders(): HealthProvider[] {
  return [...providers.values()];
}

export function getProvider(id: string): HealthProvider | undefined {
  return providers.get(id);
}
