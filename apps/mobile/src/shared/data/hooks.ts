import type { Assessment, Mission, Reading } from '@haven/core';
import { useCallback, useEffect, useState, useSyncExternalStore } from 'react';
import type { Preferences } from './preferences';
import { type Baseline, store, type Topic, type Zones } from './store';

function useTopic<T>(topic: Topic, read: () => T): T {
  const subscribe = useCallback((notify: () => void) => store.subscribe(topic, notify), [topic]);
  return useSyncExternalStore(subscribe, read, read);
}

export function useDataReady(): boolean {
  return useTopic('ready', store.isReady);
}

export function useMission(): Mission {
  return useTopic('mission', store.mission);
}

export function useAssessments(): Assessment[] {
  return useTopic('assessments', store.assessments);
}

export function useEvaluatedAt(): string | undefined {
  return useTopic('assessments', store.evaluatedAt);
}

export function useAssessment(indicator: string): Assessment | undefined {
  return useTopic('assessments', () => store.assessment(indicator));
}

export function useZones(): Zones {
  return useTopic('assessments', store.zones);
}

export function useReadings(indicator?: string): Reading[] {
  return useTopic('readings', () => store.readings({ indicator }));
}

export function useLatestReading(indicator: string): Reading | undefined {
  const list = useReadings(indicator);
  return list[list.length - 1];
}

export function useBaseline(indicator: string): Baseline | undefined {
  return useTopic('assessments', () => store.baseline(indicator));
}

export type PreferencesView = Preferences & {
  linkDown: boolean;
  set: (changes: Partial<Preferences>) => Promise<void>;
};

export function usePreferences(): PreferencesView {
  const preferences = useTopic('preferences', store.preferences);
  const linkDown = useTopic('mission', () => store.mission().linkDown);
  return { ...preferences, linkDown, set: store.setPreferences };
}

export function usePendingSends(): number {
  return useTopic('queue', store.pendingSends);
}

export function useAgeMin(iso: string | undefined): number | undefined {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 30_000);
    return () => clearInterval(id);
  }, []);
  if (!iso) return undefined;
  return Math.max(0, Math.floor((now - new Date(iso).getTime()) / 60_000));
}
