import { isTracked, type Reading } from '@haven/core';
import { Platform } from 'react-native';
import {
  aerobicMinutes,
  dailyTotalReading,
  resistanceMinutes,
  rhythmFromEcg,
  type SourceStatus,
  sleepNights,
  WRIST_BASELINE_NIGHTS,
  wristTemperatureDeviations,
} from '../logic/sources';
import { planTestSamples, TEST_QUANTITY_TYPES, TEST_SLEEP_TYPE } from '../logic/test-samples';
import type { SourceProvider } from './types';

type HealthKitModule = typeof import('@kingstinct/react-native-healthkit');
type QuantityId = Parameters<HealthKitModule['queryQuantitySamples']>[0];

type Mapping = {
  indicator: string;
  type: QuantityId;
  hkUnit: string;
  unit: string;
  decimals: number;
  cumulative?: boolean;
  scale?: number;
};

const ALL_MAPPINGS: Mapping[] = [
  {
    indicator: 'steps',
    type: 'HKQuantityTypeIdentifierStepCount',
    hkUnit: 'count',
    unit: 'steps',
    decimals: 0,
    cumulative: true,
  },
  {
    indicator: 'distance',
    type: 'HKQuantityTypeIdentifierDistanceWalkingRunning',
    hkUnit: 'km',
    unit: 'km',
    decimals: 2,
    cumulative: true,
  },
  {
    indicator: 'floors',
    type: 'HKQuantityTypeIdentifierFlightsClimbed',
    hkUnit: 'count',
    unit: 'floors',
    decimals: 0,
    cumulative: true,
  },
  {
    indicator: 'weight',
    type: 'HKQuantityTypeIdentifierBodyMass',
    hkUnit: 'kg',
    unit: 'kg',
    decimals: 1,
  },
  {
    indicator: 'body-temperature',
    type: 'HKQuantityTypeIdentifierBodyTemperature',
    hkUnit: 'degC',
    unit: '°C',
    decimals: 1,
  },
  {
    indicator: 'glucose',
    type: 'HKQuantityTypeIdentifierBloodGlucose',
    hkUnit: 'mg/dL',
    unit: 'mg/dL',
    decimals: 0,
  },
  {
    indicator: 'systolic-bp',
    type: 'HKQuantityTypeIdentifierBloodPressureSystolic',
    hkUnit: 'mmHg',
    unit: 'mmHg',
    decimals: 0,
  },
  {
    indicator: 'diastolic-bp',
    type: 'HKQuantityTypeIdentifierBloodPressureDiastolic',
    hkUnit: 'mmHg',
    unit: 'mmHg',
    decimals: 0,
  },
  {
    indicator: 'spo2',
    type: 'HKQuantityTypeIdentifierOxygenSaturation',
    hkUnit: '%',
    unit: '%',
    decimals: 0,
    scale: 100,
  },
  {
    indicator: 'heart-rate',
    type: 'HKQuantityTypeIdentifierHeartRate',
    hkUnit: 'count/min',
    unit: 'bpm',
    decimals: 0,
  },
  {
    indicator: 'cabin-noise',
    type: 'HKQuantityTypeIdentifierEnvironmentalAudioExposure',
    hkUnit: 'dBASPL',
    unit: 'dB',
    decimals: 0,
  },
  {
    indicator: 'hrv',
    type: 'HKQuantityTypeIdentifierHeartRateVariabilitySDNN',
    hkUnit: 'ms',
    unit: 'ms',
    decimals: 0,
  },
];

export const HEALTHKIT_MAPPINGS: Mapping[] = ALL_MAPPINGS.filter((m) => isTracked(m.indicator));

const PRIMARY = ['steps'];
const SLEEP_TYPE = 'HKCategoryTypeIdentifierSleepAnalysis' as const;
const WRIST_TYPE = 'HKQuantityTypeIdentifierAppleSleepingWristTemperature' as const;
const IRREGULAR_RHYTHM_TYPE = 'HKCategoryTypeIdentifierIrregularHeartRhythmEvent' as const;
const ECG_TYPE = 'HKElectrocardiogramType' as const;
const WORKOUT_TYPE = 'HKWorkoutTypeIdentifier' as const;
const WRIST_HISTORY_DAYS = 35;
const DERIVED = [
  'sleep',
  'wrist-temperature',
  'heart-rhythm',
  'resistance-exercise',
  'aerobic-exercise',
].filter(isTracked);
const INDICATORS = [...HEALTHKIT_MAPPINGS.map((m) => m.indicator), ...DERIVED];
const TO_READ = [
  ...HEALTHKIT_MAPPINGS.map((m) => m.type),
  SLEEP_TYPE,
  WRIST_TYPE,
  IRREGULAR_RHYTHM_TYPE,
  ECG_TYPE,
  WORKOUT_TYPE,
];
const HISTORY_DAYS = 7;
const DAY_MS = 86_400_000;

let module: HealthKitModule | null | undefined;

function healthKit(): HealthKitModule | null {
  if (module !== undefined) return module;
  if (Platform.OS !== 'ios') {
    module = null;
    return module;
  }
  try {
    module = require('@kingstinct/react-native-healthkit') as HealthKitModule;
    if (!module.isHealthDataAvailable()) module = null;
  } catch {
    module = null;
  }
  return module;
}

const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate());

function base(state: SourceStatus['state'], reason?: string): SourceStatus {
  return {
    id: 'healthkit',
    state,
    indicators: INDICATORS,
    primary: PRIMARY,
    withData: [],
    reason,
  };
}

export function createHealthKitProvider(): SourceProvider {
  let status: SourceStatus = base(
    'unavailable',
    Platform.OS === 'ios' ? 'reasonNeedsBuild' : 'reasonIosOnly',
  );
  const withData = new Set<string>();
  let lastSync: Date | null = null;
  let asked = false;

  function update(next: Partial<SourceStatus>) {
    status = { ...status, ...next, withData: [...withData] };
    return status;
  }

  async function readMapping(
    hk: HealthKitModule,
    m: Mapping,
    since: Date,
    now: Date,
    crewMember: string,
  ) {
    const out: Reading[] = [];
    if (m.cumulative) {
      for (let day = startOfDay(since); day <= now; day = new Date(day.getTime() + DAY_MS)) {
        const nextDay = startOfDay(new Date(day.getTime() + DAY_MS * 1.5));
        const end = nextDay < now ? nextDay : now;
        const stats = await hk.queryStatisticsForQuantity(m.type, ['cumulativeSum'], {
          unit: m.hkUnit as never,
          filter: { date: { startDate: day, endDate: end } },
        });
        const total = stats.sumQuantity?.quantity;
        if (total === undefined || total <= 0) continue;
        out.push(
          dailyTotalReading({
            provider: 'healthkit',
            source: 'healthkit',
            indicator: m.indicator,
            unit: m.unit,
            total: total * (m.scale ?? 1),
            decimals: m.decimals,
            day,
            takenAt: stats.endDate && stats.endDate < end ? stats.endDate : end,
            crewMember,
          }),
        );
      }
      return out;
    }
    const samples = await hk.queryQuantitySamples(m.type, {
      limit: 200,
      ascending: false,
      unit: m.hkUnit,
      filter: { date: { startDate: since, endDate: now } },
    });
    for (const s of samples) {
      const factor = 10 ** m.decimals;
      out.push({
        id: `healthkit:${s.uuid}`,
        indicator: m.indicator,
        value: Math.round(s.quantity * (m.scale ?? 1) * factor) / factor,
        unit: m.unit,
        takenAt: new Date(s.endDate).toISOString(),
        source: 'healthkit',
        simulated: false,
        crewMember,
      });
    }
    return out;
  }

  async function readSleep(hk: HealthKitModule, since: Date, now: Date, crewMember: string) {
    const samples = await hk.queryCategorySamples(SLEEP_TYPE, {
      limit: 0,
      ascending: true,
      filter: { date: { startDate: new Date(since.getTime() - DAY_MS / 2), endDate: now } },
    });
    return sleepNights(
      samples.map((x) => ({
        start: new Date(x.startDate),
        end: new Date(x.endDate),
        value: Number(x.value),
      })),
    ).map(
      (night): Reading => ({
        id: `healthkit:sleep:${night.day}:${night.hours}`,
        indicator: 'sleep',
        value: night.hours,
        unit: 'h',
        takenAt: night.end.toISOString(),
        source: 'healthkit',
        simulated: false,
        crewMember,
      }),
    );
  }

  async function readWristTemperature(
    hk: HealthKitModule,
    since: Date,
    now: Date,
    crewMember: string,
  ) {
    const samples = await hk.queryQuantitySamples(WRIST_TYPE, {
      limit: 0,
      ascending: true,
      unit: 'degC',
      filter: {
        date: { startDate: new Date(now.getTime() - WRIST_HISTORY_DAYS * DAY_MS), endDate: now },
      },
    });
    if (samples.length <= WRIST_BASELINE_NIGHTS) return [];
    return wristTemperatureDeviations(
      samples.map((x) => ({ id: x.uuid, value: x.quantity, end: new Date(x.endDate) })),
    )
      .filter((d) => d.end >= since)
      .map(
        (d): Reading => ({
          id: `healthkit:${d.id}`,
          indicator: 'wrist-temperature',
          value: d.deviation,
          unit: 'Δ°C',
          takenAt: d.end.toISOString(),
          source: 'healthkit',
          simulated: false,
          crewMember,
        }),
      );
  }

  async function readRhythm(hk: HealthKitModule, since: Date, now: Date, crewMember: string) {
    const filter = { date: { startDate: since, endDate: now } };
    const reading = (uuid: string, value: string, end: Date): Reading => ({
      id: `healthkit:${uuid}`,
      indicator: 'heart-rhythm',
      value,
      unit: 'category',
      takenAt: end.toISOString(),
      source: 'healthkit',
      simulated: false,
      crewMember,
    });
    const out: Reading[] = [];
    const ecgs = await hk.queryElectrocardiogramSamples({ limit: 50, ascending: true, filter });
    for (const ecg of ecgs) {
      const rhythm = rhythmFromEcg(ecg.classification);
      if (rhythm) out.push(reading(ecg.uuid, rhythm, new Date(ecg.endDate)));
    }
    const events = await hk.queryCategorySamples(IRREGULAR_RHYTHM_TYPE, {
      limit: 50,
      ascending: true,
      filter,
    });
    for (const event of events) out.push(reading(event.uuid, 'irregular', new Date(event.endDate)));
    return out.sort((a, b) => a.takenAt.localeCompare(b.takenAt));
  }

  async function readWorkouts(
    hk: HealthKitModule,
    since: Date,
    now: Date,
    crewMember: string,
    kind: 'resistance' | 'aerobic',
  ) {
    const workouts = await hk.queryWorkoutSamples({
      limit: 0,
      ascending: true,
      filter: { date: { startDate: startOfDay(since), endDate: now } },
    });
    const toSeconds = (d: { unit: string; quantity: number }) =>
      d.unit === 'min' ? d.quantity * 60 : d.unit === 'hr' ? d.quantity * 3600 : d.quantity;
    return (kind === 'resistance' ? resistanceMinutes : aerobicMinutes)(
      workouts.map((w) => ({
        type: Number(w.workoutActivityType),
        end: new Date(w.endDate),
        seconds: toSeconds(w.duration),
      })),
    ).map((d) =>
      dailyTotalReading({
        provider: 'healthkit',
        source: 'healthkit',
        indicator: `${kind}-exercise`,
        unit: 'min',
        total: d.minutes,
        decimals: 0,
        day: d.day,
        takenAt: d.end,
        crewMember,
      }),
    );
  }

  const readResistance = (hk: HealthKitModule, since: Date, now: Date, crewMember: string) =>
    readWorkouts(hk, since, now, crewMember, 'resistance');
  const readAerobic = (hk: HealthKitModule, since: Date, now: Date, crewMember: string) =>
    readWorkouts(hk, since, now, crewMember, 'aerobic');

  const derived: [string, typeof readSleep][] = [
    ['sleep', readSleep],
    ['wrist-temperature', readWristTemperature],
    ['heart-rhythm', readRhythm],
    ['resistance-exercise', readResistance],
    ['aerobic-exercise', readAerobic],
  ];

  const provider: SourceProvider = {
    id: 'healthkit',
    status: () => status,

    async isAvailable() {
      return healthKit() !== null;
    },

    async refresh() {
      const hk = healthKit();
      if (!hk)
        return update(
          base('unavailable', Platform.OS === 'ios' ? 'reasonNeedsBuild' : 'reasonIosOnly'),
        );
      try {
        const request = await hk.getRequestStatusForAuthorization({ toRead: TO_READ });
        asked = request === hk.AuthorizationRequestStatus.unnecessary;
        if (!asked) return update({ state: 'needsPermission', reason: undefined });
        if (withData.size > 0) return update({ state: 'connected', reason: undefined });
        return update({
          state: lastSync ? 'denied' : 'connected',
          reason: lastSync ? 'reasonHealthkitNoData' : undefined,
        });
      } catch {
        return update({ state: 'needsPermission', reason: undefined });
      }
    },

    async requestPermission() {
      const hk = healthKit();
      if (!hk) return provider.refresh();
      try {
        await hk.requestAuthorization({ toRead: TO_READ });
        asked = true;
      } catch (error) {
        console.warn('[health-sources] HealthKit authorization failed', error);
      }
      return provider.refresh();
    },

    async read(indicator, since) {
      const hk = healthKit();
      const m = HEALTHKIT_MAPPINGS.find((x) => x.indicator === indicator);
      if (!hk || !m || !asked) return [];
      return readMapping(hk, m, new Date(since), new Date(), '');
    },

    subscribe(indicator, cb) {
      const hk = healthKit();
      const m = HEALTHKIT_MAPPINGS.find((x) => x.indicator === indicator);
      if (!hk || !m || !asked) return () => {};
      const subscription = hk.subscribeToChanges(m.type, () => {
        void readMapping(hk, m, startOfDay(new Date()), new Date(), '').then((list) => {
          const last = list[list.length - 1];
          if (last) cb(last);
        });
      });
      return () => subscription.remove();
    },

    async sync(crewMember, now) {
      const hk = healthKit();
      if (!hk || !asked) return [];
      const since = lastSync
        ? new Date(Math.min(lastSync.getTime(), startOfDay(now).getTime()))
        : new Date(now.getTime() - HISTORY_DAYS * DAY_MS);
      const all: Reading[] = [];
      for (const m of HEALTHKIT_MAPPINGS) {
        try {
          const list = await readMapping(hk, m, since, now, crewMember);
          if (list.length > 0) withData.add(m.indicator);
          all.push(...list);
        } catch (error) {
          console.warn(`[health-sources] HealthKit read failed: ${m.indicator}`, error);
        }
      }
      for (const [indicator, read] of derived) {
        if (!isTracked(indicator)) continue;
        try {
          const list = await read(hk, since, now, crewMember);
          if (list.length > 0) withData.add(indicator);
          all.push(...list);
        } catch (error) {
          console.warn(`[health-sources] HealthKit read failed: ${indicator}`, error);
        }
      }
      lastSync = now;
      update({ lastSyncAt: now.toISOString() });
      await provider.refresh();
      return all;
    },

    resetSync() {
      lastSync = null;
      withData.clear();
      update({ lastSyncAt: undefined });
    },

    async writeTestSamples(now) {
      const hk = healthKit();
      if (!hk) return 0;
      await hk.requestAuthorization({
        toShare: [...TEST_QUANTITY_TYPES, TEST_SLEEP_TYPE],
        toRead: TO_READ,
      });
      asked = true;
      lastSync = null;
      const windowStart = new Date(now.getTime() - (HISTORY_DAYS + 1) * DAY_MS);
      for (const type of [...TEST_QUANTITY_TYPES, TEST_SLEEP_TYPE]) {
        try {
          await hk.deleteObjects(type, { date: { startDate: windowStart, endDate: now } });
        } catch (error) {
          console.warn('[health-sources] could not delete previous test samples', type, error);
        }
      }
      let written = 0;
      for (const p of planTestSamples(now)) {
        try {
          if (p.kind === 'sleep') {
            await hk.saveCategorySample(
              TEST_SLEEP_TYPE,
              hk.CategoryValueSleepAnalysis.asleepCore,
              p.start,
              p.end,
            );
          } else {
            await hk.saveQuantitySample(
              p.type as (typeof TEST_QUANTITY_TYPES)[number],
              p.unit as never,
              p.value,
              p.start,
              p.end,
            );
          }
          written++;
        } catch (error) {
          console.warn('[health-sources] could not write test sample', p, error);
        }
      }
      return written;
    },

    watchChanges(onChange) {
      const hk = healthKit();
      if (!hk || !asked) return () => {};
      const subscriptions = HEALTHKIT_MAPPINGS.filter((m) => m.cumulative).map((m) =>
        hk.subscribeToChanges(m.type, () => onChange()),
      );
      return () => {
        for (const s of subscriptions) s.remove();
      };
    },
  };
  return provider;
}
