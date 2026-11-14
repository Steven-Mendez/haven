import type { SourceId, SourceStatus } from '../logic/sources';
import type { SourceProvider } from './types';

// M07 · Health Connect and Bluetooth (BLE GATT 0x1810 blood pressure, 0x1808 glucose) are not
// installed in this build (`react-native-health-connect`, `react-native-ble-plx`). They are
// registered so the screen lists them honestly, and always answer "unavailable" with a reason.
// Their indicators fall back to manual entry.

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
