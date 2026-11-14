import type { SourceId, SourceStatus } from '../logic/sources';
import type { SourceProvider } from './types';

function unavailable(id: SourceId, indicators: string[], reason: string): SourceProvider {
  const status: SourceStatus = {
    id,
    state: 'unavailable',
    indicators,
    primary: [],
    withData: [],
    reason,
  };
  return {
    id,
    status: () => status,
    refresh: async () => status,
    isAvailable: async () => false,
    read: async () => [],
    subscribe: () => () => {},
  };
}

export function createHealthConnectProvider(): SourceProvider {
  return unavailable(
    'healthconnect',
    ['steps', 'distance', 'floors', 'weight', 'heart-rate', 'sleep'],
    'reasonHealthConnect',
  );
}

export function createBleProvider(): SourceProvider {
  return unavailable('ble', ['systolic-bp', 'diastolic-bp', 'glucose'], 'reasonBle');
}
