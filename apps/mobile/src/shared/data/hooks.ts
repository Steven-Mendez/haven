import type { Assessment, Mission, Reading } from '@haven/core';
import { useCallback, useEffect, useState, useSyncExternalStore } from 'react';
import type { Preferences } from './preferences';
import { type Baseline, store, type Topic, type Zones } from './store';

// Reactive hooks over the store: they re-render when their topic changes.

function useTopic<T>(topic: Topic, read: () => T): T {
  const subscribe = useCallback((notify: () => void) => store.subscribe(topic, notify), [topic]);
  return useSyncExternalStore(subscribe, read, read);
}

/** `true` once the database is loaded and the first evaluation is done. */
export function useDataReady(): boolean {
  return useTopic('ready', store.isReady);
}

export function useMission(): Mission {
  return useTopic('mission', store.mission);
}

/** One `Assessment` per config indicator, for the current crew member. */
export function useAssessments(): Assessment[] {
  return useTopic('assessments', store.assessments);
}

/** ISO time of the last evaluation (re-evaluated on every reading and every minute). */
export function useEvaluatedAt(): string | undefined {
  return useTopic('assessments', store.evaluatedAt);
}

/** Assessment of one indicator, or `undefined` if the config does not have it. */
export function useAssessment(indicator: string): Assessment | undefined {
  return useTopic('assessments', () => store.assessment(indicator));
}

/** `evaluateZones` of the current assessments: `{ zone, level, assessments }[]`. */
export function useZones(): Zones {
  return useTopic('assessments', store.zones);
}

/** Readings of the current crew member (all, or one indicator), sorted by `takenAt`. */
export function useReadings(indicator?: string): Reading[] {
  // Changing the crew member also notifies 'readings'.
  return useTopic('readings', () => store.readings({ indicator }));
}

/** Latest reading of the current crew member for one indicator. */
export function useLatestReading(indicator: string): Reading | undefined {
  const list = useReadings(indicator);
  return list[list.length - 1];
}

export function useBaseline(indicator: string): Baseline | undefined {
  return useTopic('assessments', () => store.baseline(indicator));
}

export type PreferencesView = Preferences & {
  /** Mirror of `Mission.linkDown` (change it with `store.setMission`). */
  linkDown: boolean;
  set: (changes: Partial<Preferences>) => Promise<void>;
};

export function usePreferences(): PreferencesView {
  const preferences = useTopic('preferences', store.preferences);
  const linkDown = useTopic('mission', () => store.mission().linkDown);
  return { ...preferences, linkDown, set: store.setPreferences };
}

/** Packets waiting in the Earth queue (M09 counter). */
export function usePendingSends(): number {
  return useTopic('queue', store.pendingSends);
}

/** Minutes since `iso`, refreshed every 30 s. To show the age of a reading. */
export function useAgeMin(iso: string | undefined): number | undefined {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 30_000);
    return () => clearInterval(id);
  }, []);
  if (!iso) return undefined;
  return Math.max(0, Math.floor((now - new Date(iso).getTime()) / 60_000));
}
