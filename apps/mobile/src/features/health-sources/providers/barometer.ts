import type { Reading } from '@haven/core';
import { Barometer } from 'expo-sensors';
import {
  CABIN_PRESSURE,
  cabinPressureReading,
  isPressureChange,
  kPaFromHPa,
} from '../logic/barometer';
import type { SourceStatus } from '../logic/sources';
import type { SourceProvider } from './types';

const SAMPLE_TIMEOUT_MS = 4_000;
const FRESH_MS = 60_000;

function base(state: SourceStatus['state'], reason?: string): SourceStatus {
  return {
    id: 'barometer',
    state,
    indicators: [CABIN_PRESSURE],
    primary: [CABIN_PRESSURE],
    withData: [],
    reason,
  };
}

export function createBarometerProvider(): SourceProvider {
  let status = base('unavailable', 'reasonNoBarometer');
  let last: { kPa: number; at: number } | undefined;
  let notified: number | undefined;

  async function available() {
    try {
      return await Barometer.isAvailableAsync();
    } catch {
      return false;
    }
  }

  function sample(): Promise<number | undefined> {
    if (last && Date.now() - last.at < FRESH_MS) return Promise.resolve(last.kPa);
    return new Promise((resolve) => {
      let done = false;
      const finish = (kPa: number | undefined) => {
        if (done) return;
        done = true;
        clearTimeout(timer);
        subscription.remove();
        resolve(kPa);
      };
      const timer = setTimeout(() => finish(undefined), SAMPLE_TIMEOUT_MS);
      const subscription = Barometer.addListener(({ pressure }) => {
        const kPa = kPaFromHPa(pressure);
        if (kPa === undefined) return;
        last = { kPa, at: Date.now() };
        finish(kPa);
      });
    });
  }

  async function current(crewMember: string, now: Date): Promise<Reading | null> {
    const kPa = await sample();
    return kPa === undefined ? null : cabinPressureReading({ kPa, takenAt: now, crewMember });
  }

  const provider: SourceProvider = {
    id: 'barometer',
    status: () => status,
    isAvailable: available,

    async refresh() {
      if (!(await available())) {
        status = base('unavailable', 'reasonNoBarometer');
        return status;
      }
      try {
        const permission = await Barometer.getPermissionsAsync();
        if (permission.granted) {
          status = {
            ...base('connected'),
            withData: last ? [CABIN_PRESSURE] : [],
            lastSyncAt: status.lastSyncAt,
          };
        } else if (permission.canAskAgain) {
          status = base('needsPermission');
        } else {
          status = base('denied', 'reasonMotionDenied');
        }
      } catch {
        status = base('needsPermission');
      }
      return status;
    },

    async requestPermission() {
      if (await available()) {
        try {
          await Barometer.requestPermissionsAsync();
        } catch (error) {
          console.warn('[health-sources] barometer permission failed', error);
        }
      }
      return provider.refresh();
    },

    async read(indicator, since) {
      if (indicator !== CABIN_PRESSURE || status.state !== 'connected') return [];
      const now = new Date();
      if (new Date(since) > now) return [];
      const reading = await current('', now);
      return reading ? [reading] : [];
    },

    subscribe(indicator, cb) {
      if (indicator !== CABIN_PRESSURE || status.state !== 'connected') return () => {};
      let sent: number | undefined;
      const subscription = Barometer.addListener(({ pressure }) => {
        const kPa = kPaFromHPa(pressure);
        if (kPa === undefined || !isPressureChange(sent, kPa)) return;
        sent = kPa;
        cb(cabinPressureReading({ kPa, takenAt: new Date(), crewMember: '' }));
      });
      return () => subscription.remove();
    },

    async sync(crewMember, now) {
      if (status.state !== 'connected') return [];
      try {
        const reading = await current(crewMember, now);
        if (reading) {
          notified = Number(reading.value);
          status = { ...status, withData: [CABIN_PRESSURE], lastSyncAt: now.toISOString() };
          return [reading];
        }
      } catch (error) {
        console.warn('[health-sources] barometer read failed', error);
      }
      return [];
    },

    resetSync() {
      last = undefined;
      notified = undefined;
      if (status.state === 'connected') status = base('connected');
    },

    watchChanges(onChange) {
      if (status.state !== 'connected') return () => {};
      const subscription = Barometer.addListener(({ pressure }) => {
        const kPa = kPaFromHPa(pressure);
        if (kPa === undefined) return;
        last = { kPa, at: Date.now() };
        if (!isPressureChange(notified, kPa)) return;
        notified = kPa;
        onChange();
      });
      return () => subscription.remove();
    },
  };
  return provider;
}
