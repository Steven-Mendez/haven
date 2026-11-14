import { dayHistory } from '@haven/core';
import Storage from 'expo-sqlite/kv-store';
import { useEffect, useMemo, useState } from 'react';

import { config } from '@/shared/config';
import { useMission, useReadings } from '@/shared/data';
import { db } from '@/shared/db';
import { bus } from '@/shared/events';

import { type DayRings, dateKey, ringHistory, ringsForDay } from './logic/rings';
import { bestStreak, currentStreak } from './logic/streak';

export { type DayRings, dateKey, fraction, type RingValue } from './logic/rings';
export {
  MISSION_MILESTONES,
  pendingMilestone,
  STREAK_MILESTONES,
} from './logic/streak';

type ProtectedDay = { id: string; date: string; reason: 'emergency' | 'link-down' };
const protectedDays = db.collection<ProtectedDay>('protected_days');
const listeners = new Set<() => void>();

function protect(reason: ProtectedDay['reason']) {
  const date = dateKey(Date.now());
  void protectedDays
    .put(`${date}-${reason}`, { id: `${date}-${reason}`, date, reason })
    .then(() => {
      for (const l of listeners) l();
    })
    .catch((e) => console.warn('[gamification] protected day not saved', e));
}

bus.on('emergency:open', () => protect('emergency'));
bus.on('mission:changed', (mission) => {
  if (mission.linkDown) protect('link-down');
});

function useProtectedDays(): string[] {
  const [dates, setDates] = useState<string[]>([]);
  const mission = useMission();
  useEffect(() => {
    const load = () =>
      void protectedDays
        .all()
        .then((all) => setDates([...new Set(all.map((d) => d.date))]))
        .catch(() => setDates([]));
    load();
    listeners.add(load);
    return () => {
      listeners.delete(load);
    };
  }, []);
  return mission.linkDown ? [...dates, dateKey(Date.now())] : dates;
}

export type Gamification = {
  today: DayRings;
  week: DayRings[];
  streak: number;
  best: number;
  protectedDays: string[];
};

export function useGamification(): Gamification {
  const readings = useReadings();
  const safe = useProtectedDays();
  return useMemo(() => {
    const now = new Date();
    const week = ringHistory(readings, config, now, 7);
    const history = dayHistory(readings, config, now, 90);
    const today = dateKey(now);
    return {
      today: week[week.length - 1],
      week,
      streak: currentStreak(history, today, safe),
      best: bestStreak(history, safe),
      protectedDays: safe,
    };
  }, [readings, safe]);
}

export function useRingDays(dates: string[]): { days: DayRings[]; firstDay: string | undefined } {
  const readings = useReadings();
  return useMemo(() => {
    const now = new Date();
    const today = dateKey(now);
    const firstDay = readings.reduce<string | undefined>((min, r) => {
      const d = dateKey(r.takenAt);
      return min === undefined || d < min ? d : min;
    }, undefined);
    return {
      days: dates.filter((d) => d <= today).map((d) => ringsForDay(readings, config, d, now)),
      firstDay,
    };
  }, [readings, dates]);
}

const MILESTONES_KEY = 'haven.milestones.v1';
export function seenMilestones(): string[] {
  try {
    return JSON.parse(Storage.getItemSync(MILESTONES_KEY) ?? '[]');
  } catch {
    return [];
  }
}
export function markMilestoneSeen(key: string) {
  try {
    Storage.setItemSync(MILESTONES_KEY, JSON.stringify([...new Set([...seenMilestones(), key])]));
  } catch {}
}

type MilestonePreview = (value: number) => void;
const previewListeners = new Set<MilestonePreview>();

export function previewMilestone(value: number) {
  for (const l of previewListeners) l(value);
}

export function onMilestonePreview(listener: MilestonePreview): () => void {
  previewListeners.add(listener);
  return () => {
    previewListeners.delete(listener);
  };
}
