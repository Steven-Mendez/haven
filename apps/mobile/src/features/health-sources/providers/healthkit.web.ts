import type { SourceStatus } from '../logic/sources';
import type { SourceProvider } from './types';

export const HEALTHKIT_MAPPINGS: { indicator: string }[] = [];

export function createHealthKitProvider(): SourceProvider {
  const status: SourceStatus = {
    id: 'healthkit',
    state: 'unavailable',
    indicators: ['steps', 'distance', 'floors'],
    primary: ['steps', 'distance', 'floors'],
    withData: [],
    reason: 'reasonIosOnly',
  };
  return {
    id: 'healthkit',
    status: () => status,
    refresh: async () => status,
    isAvailable: async () => false,
    read: async () => [],
    subscribe: () => () => {},
  };
}
