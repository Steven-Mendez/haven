import type { Reading } from '@haven/core';
import { useSyncExternalStore } from 'react';
import { store } from '@/shared/data';
import { bus } from '@/shared/events';
import { registerProvider } from '@/shared/health';
import { dedupe, isSameSample } from './logic/dedupe';
import type { SourceId, SourceStatus } from './logic/sources';
import { createBarometerProvider } from './providers/barometer';
import { createHealthKitProvider } from './providers/healthkit';
import { createPedometerProvider } from './providers/pedometer';
import type { SourceProvider } from './providers/types';
import { createBleProvider, createHealthConnectProvider } from './providers/unavailable';

const SYNC_EVERY_MS = 15 * 60_000;
const CHANGE_DEBOUNCE_MS = 5_000;

const healthkit = createHealthKitProvider();
const pedometer = createPedometerProvider();
const barometer = createBarometerProvider();
const providers: SourceProvider[] = [
  healthkit,
  pedometer,
  barometer,
  createHealthConnectProvider(),
  createBleProvider(),
];

let snapshot: SourceStatus[] = providers.map((p) => p.status());
const listeners = new Set<() => void>();
let started = false;
let syncing: Promise<void> | null = null;
let debounce: ReturnType<typeof setTimeout> | null = null;
const unwatch: (() => void)[] = [];

function publish() {
  snapshot = providers.map((p) => p.status());
  for (const listener of [...listeners]) listener();
}

function removeReadings(ids: string[]) {
  if (ids.length === 0) return;
  const remove = (store as { removeReadings?: (ids: string[]) => Promise<void> }).removeReadings;
  if (remove) void remove(ids);
}

async function save(readings: Reading[]) {
  if (readings.length === 0) return;
  const oldest = readings.map((r) => r.takenAt).sort()[0] ?? new Date().toISOString();
  const since = new Date(Date.parse(oldest) - 5 * 60_000).toISOString();
  const { save: toSave, supersede } = dedupe(readings, store.readings({ since }));
  removeReadings(supersede);
  await store.saveReadings(toSave);
}

export function syncNow(): Promise<void> {
  syncing ??= (async () => {
    const now = new Date();
    const { crewMember } = store.preferences();
    try {
      const fromHealthKit = (await healthkit.sync?.(crewMember, now)) ?? [];
      await save(fromHealthKit);
      if (!healthkit.status().withData.includes('steps')) {
        await save((await pedometer.sync?.(crewMember, now)) ?? []);
      }
      await save((await barometer.sync?.(crewMember, now)) ?? []);
    } catch (error) {
      console.warn('[health-sources] sync failed', error);
    } finally {
      publish();
      syncing = null;
    }
  })();
  return syncing;
}

function scheduleSync() {
  if (debounce) clearTimeout(debounce);
  debounce = setTimeout(() => void syncNow(), CHANGE_DEBOUNCE_MS);
}

function rewatch() {
  for (const stop of unwatch.splice(0)) stop();
  for (const p of providers) if (p.watchChanges) unwatch.push(p.watchChanges(scheduleSync));
}

export async function refreshSources(): Promise<SourceStatus[]> {
  await Promise.all(providers.map((p) => p.refresh().catch(() => p.status())));
  publish();
  return snapshot;
}

export async function requestPermission(id: SourceId): Promise<void> {
  const provider = providers.find((p) => p.id === id);
  if (!provider?.requestPermission) return;
  await provider.requestPermission();
  publish();
  rewatch();
  await syncNow();
}

export async function writeHealthKitTestSamples(): Promise<number> {
  const written = (await healthkit.writeTestSamples?.(new Date())) ?? 0;
  await healthkit.refresh();
  publish();
  rewatch();
  await syncNow();
  return written;
}

export async function startHealthSources(): Promise<void> {
  if (started) return;
  started = true;
  for (const p of providers) registerProvider(p);
  await refreshSources();
  rewatch();
  void syncNow();
  setInterval(() => void syncNow(), SYNC_EVERY_MS);

  bus.on('data:reset', () => {
    for (const p of providers) p.resetSync?.();
    publish();
    void syncNow();
  });

  bus.on('reading:new', (reading) => {
    if (reading.source !== 'watch') return;
    const since = new Date(Date.parse(reading.takenAt) - 5 * 60_000).toISOString();
    const twin = store
      .readings({ indicator: reading.indicator, since, crewMember: reading.crewMember })
      .find((r) => r.source === 'healthkit' && isSameSample(r, reading));
    if (twin) removeReadings([reading.id]);
  });
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function useSourceStatuses(): SourceStatus[] {
  return useSyncExternalStore(
    subscribe,
    () => snapshot,
    () => snapshot,
  );
}
