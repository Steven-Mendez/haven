import type { Reading } from '@haven/core';
import { Pedometer } from 'expo-sensors';
import { Platform } from 'react-native';
import { dailyTotalReading, type SourceStatus } from '../logic/sources';
import type { SourceProvider } from './types';

const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate());

function base(state: SourceStatus['state'], reason?: string): SourceStatus {
  return {
    id: 'pedometer',
    state,
    indicators: ['steps'],
    primary: ['steps'],
    withData: [],
    reason,
  };
}

export function createPedometerProvider(): SourceProvider {
  let status = base(
    'unavailable',
    Platform.OS === 'android' ? 'reasonPedometerAndroid' : 'reasonNoSensor',
  );
  let hasData = false;
  const supported = Platform.OS === 'ios';

  async function available() {
    if (!supported) return false;
    try {
      return await Pedometer.isAvailableAsync();
    } catch {
      return false;
    }
  }

  async function todayTotal(crewMember: string, now: Date): Promise<Reading | null> {
    const { steps } = await Pedometer.getStepCountAsync(startOfDay(now), now);
    if (!(steps > 0)) return null;
    return dailyTotalReading({
      provider: 'pedometer',
      source: 'healthkit',
      indicator: 'steps',
      unit: 'steps',
      total: steps,
      decimals: 0,
      day: now,
      takenAt: now,
      crewMember,
    });
  }

  const provider: SourceProvider = {
    id: 'pedometer',
    status: () => status,
    isAvailable: available,

    async refresh() {
      if (!(await available())) {
        status = base(
          'unavailable',
          Platform.OS === 'android' ? 'reasonPedometerAndroid' : 'reasonNoSensor',
        );
        return status;
      }
      try {
        const permission = await Pedometer.getPermissionsAsync();
        if (permission.granted) {
          status = { ...base('connected'), withData: hasData ? ['steps'] : [] };
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
          await Pedometer.requestPermissionsAsync();
        } catch (error) {
          console.warn('[health-sources] motion permission failed', error);
        }
      }
      return provider.refresh();
    },

    async read(indicator, since) {
      if (indicator !== 'steps' || status.state !== 'connected') return [];
      const now = new Date();
      if (new Date(since) > now) return [];
      const reading = await todayTotal('', now);
      return reading ? [reading] : [];
    },

    subscribe(indicator, cb) {
      if (indicator !== 'steps' || status.state !== 'connected') return () => {};
      const subscription = Pedometer.watchStepCount(() => {
        void todayTotal('', new Date()).then((r) => r && cb(r));
      });
      return () => subscription.remove();
    },

    async sync(crewMember, now) {
      if (status.state !== 'connected') return [];
      try {
        const reading = await todayTotal(crewMember, now);
        if (reading) {
          hasData = true;
          status = { ...status, withData: ['steps'], lastSyncAt: now.toISOString() };
          return [reading];
        }
      } catch (error) {
        console.warn('[health-sources] pedometer read failed', error);
      }
      return [];
    },

    watchChanges(onChange) {
      if (status.state !== 'connected') return () => {};
      const subscription = Pedometer.watchStepCount(() => onChange());
      return () => subscription.remove();
    },
  };
  return provider;
}
