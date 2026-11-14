import type { Mission } from '@haven/core';
import { useEffect, useSyncExternalStore } from 'react';
import { store } from '@/shared/data';
import { db } from '@/shared/db';
import { bus } from '@/shared/events';
import {
  markerForClosedEmergency,
  markerId,
  markersFromMissionChange,
  type TrendMarker,
} from '../logic/markers';

// Chart event markers (M04), persisted in the `trend_markers` collection. The bus listeners are
// registered when this module is imported (the trends route loads it at app start), so emergencies
// and environment changes are recorded even while the Trends tab is not open.

const COLLECTION = 'trend_markers';
/** Older markers are dropped (the longest range shows the last 30 days of data). */
const KEEP_MS = 60 * 86_400_000;

const collection = db.collection<TrendMarker>(COLLECTION);
let markers: TrendMarker[] = [];
let loading: Promise<void> | null = null;
let previous: Pick<Mission, 'environment'> | undefined;
const listeners = new Set<() => void>();

function notify() {
  for (const listener of [...listeners]) listener();
}

function remember(mission: Mission) {
  previous = { environment: mission.environment };
}

/** Inserts new markers and replaces those with the same id (upsert). */
function add(list: TrendMarker[]) {
  const fresh = list.filter((m) => {
    const known = markers.find((k) => k.id === m.id);
    return !known || JSON.stringify(known) !== JSON.stringify(m);
  });
  if (fresh.length === 0) return;
  const ids = new Set(fresh.map((m) => m.id));
  markers = [...markers.filter((m) => !ids.has(m.id)), ...fresh].sort((a, b) => a.t - b.t);
  notify();
  void Promise.all(fresh.map((m) => collection.put(m.id, m))).catch((error) =>
    console.warn('[trends] could not save markers', error),
  );
}

/** Loads persisted markers once the database is open (store ready). Idempotent. */
function load(): Promise<void> {
  if (!store.isReady()) return Promise.resolve();
  previous ??= { environment: store.mission().environment };
  loading ??= (async () => {
    try {
      const saved = await collection.all();
      const cutoff = Date.now() - KEEP_MS;
      const ids = new Set(markers.map((m) => m.id));
      const kept = saved.filter((m) => m && m.t >= cutoff && !ids.has(m.id));
      for (const old of saved.filter((m) => m && m.t < cutoff)) void collection.remove(old.id);
      markers = [...markers, ...kept].sort((a, b) => a.t - b.t);
      notify();
    } catch (error) {
      console.warn('[trends] could not load markers', error);
    }
  })();
  return loading;
}

store.subscribe('ready', () => void load());
void load();

bus.on('emergency:open', ({ origin }) => {
  const t = Date.now();
  add([{ id: markerId('emergency', t, origin), t, kind: 'emergency', ref: origin }]);
});

bus.on('emergency:close', ({ packet }) => {
  const t = Date.parse(packet.createdAt);
  const marker = markerForClosedEmergency(markers, Number.isFinite(t) ? t : Date.now(), packet.id);
  if (marker) add([marker]);
});

bus.on('mission:changed', (mission) => {
  add(markersFromMissionChange(previous, mission, Date.now()));
  remember(mission);
});

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

const snapshot = () => markers;

/** Every recorded marker, sorted by time. */
export function useTrendMarkers(): TrendMarker[] {
  useEffect(() => {
    void load();
  }, []);
  return useSyncExternalStore(subscribe, snapshot, snapshot);
}
