import type { HealthProvider } from '@haven/core';

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
