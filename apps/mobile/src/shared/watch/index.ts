import {
  type Assessment,
  overallLevel,
  readingsFromEnvelope,
  WATCH_CONTRACT_VERSION,
  type WatchEnvelope,
  type WatchMessages,
  type WatchMessageType,
} from '@haven/core';
import { type EventSubscription, requireOptionalNativeModule } from 'expo';
import { useCallback, useSyncExternalStore } from 'react';
import { config } from '@/shared/config';
import { store } from '@/shared/data';
import { bus } from '@/shared/events';
import { currentLanguage, onLanguageChange } from '@/shared/i18n';

// Watch bridge (contracts B/C). Only the native HavenWatch module (W00, iOS with prebuild) exists;
// on web, Android or without a paired watch the watch is «not connected» and nothing is faked.
//   emergency → bus 'emergency:open' · mood, monitor and the emergency's trigger reading → store.saveReadings
//   'assessments:changed' / language change → sends 'status' to the watch
//   'emergency:close' → sends 'emergencyEnd' to the watch
//   'emergency:open' from the phone (not the watch) → startWatchMonitor() on the watch

/** `'native'`: HavenWatch with a paired watch app. `'none'`: no watch connected. */
export type WatchSource = 'native' | 'none';

type HavenWatchModule = {
  isAvailable(): boolean;
  isPaired(): boolean;
  isReachable?(): boolean;
  send(json: string): void;
  startWatchMonitor?(): Promise<boolean>;
  addListener(event: 'onMessage', listener: (e: { json: string }) => void): EventSubscription;
  addListener(
    event: 'onReachabilityChange',
    listener: (e: { reachable: boolean }) => void,
  ): EventSubscription;
};

// Never a static import of the module: it only exists on iOS builds with prebuild.
const native = requireOptionalNativeModule<HavenWatchModule>('HavenWatch');

/**
 * True while 'emergency:open' is emitted for an envelope received from the watch (the bus is
 * synchronous). Those emergencies already show the monitor on the watch; every other one (the
 * phone's SOS button also uses origin 'button') wakes it with startWatchMonitor().
 */
let emittingFromWatch = false;

/** A watch envelope newer than this proves the watch is connected even if WCSession says otherwise. */
const HEARD_RECENTLY_MS = 2 * 60_000;
let lastReceivedAt = 0;

/**
 * Paired with the watch app installed, or the watch talked to us just now (WCSession's `isWatchAppInstalled`
 * can lag behind a watch that is already sending its pulse).
 */
function connected(): boolean {
  try {
    if (!native?.isAvailable()) return false;
    return (
      native.isPaired() ||
      Date.now() - lastReceivedAt < HEARD_RECENTLY_MS ||
      (native.isReachable?.() ?? false)
    );
  } catch {
    return false;
  }
}

const listeners = new Set<(envelope: WatchEnvelope) => void>();
const changeListeners = new Set<() => void>();
let lastStatus: WatchEnvelope<'status'> | undefined;
let lastReceived: WatchEnvelope | undefined;
let reachable = false;
let sentSignature = '';

export type WatchSnapshot = {
  source: WatchSource;
  lastStatus?: WatchEnvelope<'status'>;
  lastReceived?: WatchEnvelope;
  reachable: boolean;
};

function source(): WatchSource {
  return connected() ? 'native' : 'none';
}

function isReachable(): boolean {
  if (!connected()) return false;
  try {
    return native?.isReachable?.() ?? reachable;
  } catch {
    return reachable;
  }
}

function takeSnapshot(): WatchSnapshot {
  return { source: source(), lastStatus, lastReceived, reachable: isReachable() };
}

let snapshot: WatchSnapshot | undefined;

let notifyScheduled = false;

/**
 * The snapshot updates at once; subscribers are notified in a microtask. `send` can run during a
 * render (the emergency screen alerts the crew in a state initializer), and notifying
 * `useSyncExternalStore` subscribers synchronously there triggers React's «Cannot update a
 * component while rendering a different component» warning.
 */
function changed() {
  snapshot = takeSnapshot();
  if (notifyScheduled) return;
  notifyScheduled = true;
  queueMicrotask(() => {
    notifyScheduled = false;
    for (const fn of changeListeners) fn();
  });
}

/** Translates an envelope received from the watch into the bus and the store. */
function receive(envelope: WatchEnvelope) {
  if (!envelope || envelope.v !== WATCH_CONTRACT_VERSION) {
    console.warn('[watch] envelope with unknown version', envelope);
    return;
  }
  lastReceived = envelope;
  lastReceivedAt = Date.now();
  if (envelope.type === 'emergency') {
    const payload = envelope.payload as WatchMessages['emergency'];
    emittingFromWatch = true;
    try {
      bus.emit('emergency:open', { origin: payload.origin });
    } finally {
      emittingFromWatch = false;
    }
  }
  // mood → `mood`; monitor → `heart-rate` (+ `spo2`); emergency → the reading that fired it.
  const readings = readingsFromEnvelope({
    ...envelope,
    crewMember: envelope.crewMember || store.preferences().crewMember,
  }).map((r) => ({ ...r, simulated: false }));
  if (readings.length > 0) void store.saveReadings(readings);
  for (const listener of listeners) listener(envelope);
  changed();
}

/** Builds an envelope with version, crew member and sentAt filled in. */
function envelope<T extends WatchMessageType>(
  type: T,
  payload: WatchMessages[T],
): WatchEnvelope<T> {
  return {
    v: WATCH_CONTRACT_VERSION,
    type,
    crewMember: store.preferences().crewMember,
    simulated: false,
    sentAt: new Date().toISOString(),
    payload,
  };
}

/**
 * Sends an envelope to the watch. Returns `false` when no watch is connected. The native module still gets
 * it whenever WCSession is active: it keeps `status` and `emergencyEnd` in the application context, which
 * reaches the watch even while `isPaired()` wrongly reports no watch app (seen on simulators).
 */
function send(item: WatchEnvelope): boolean {
  if (item.type === 'status') lastStatus = item as WatchEnvelope<'status'>;
  let sent = false;
  try {
    if (native?.isAvailable()) {
      native.send(JSON.stringify(item));
      sent = connected();
    }
  } catch (error) {
    console.warn('[watch] could not send to the watch', error);
  }
  changed();
  return sent;
}

function sendStatus(assessments: Assessment[]) {
  const pending = assessments.find((a) => a.level === 'pending');
  const nextPending = pending
    ? (config.indicators.find((i) => i.id === pending.indicator)?.name[currentLanguage()] ??
      pending.indicator)
    : undefined;
  const level = overallLevel(assessments);
  const language = currentLanguage();
  const sig = `${level}|${nextPending ?? ''}|${language}`;
  if (sig === sentSignature) return;
  sentSignature = sig;
  send(
    envelope('status', {
      overallLevel: level,
      nextPending,
      evaluatedAt: new Date().toISOString(),
      language,
    }),
  );
}

/** Emergency started on the phone: wakes the watch app on its patient monitor (Rigel, W04). */
async function startWatchMonitor(): Promise<boolean> {
  if (!connected() || !native?.startWatchMonitor) return false;
  try {
    return await native.startWatchMonitor();
  } catch (error) {
    console.warn('[watch] startWatchMonitor failed', error);
    return false;
  }
}

let started = false;

/** Connects the bridge. Call after `store.start()`. */
function start() {
  if (started) return;
  started = true;
  if (native) {
    native.addListener('onMessage', ({ json }) => {
      try {
        receive(JSON.parse(json) as WatchEnvelope);
      } catch (error) {
        console.warn('[watch] invalid envelope', json, error);
      }
    });
    native.addListener('onReachabilityChange', ({ reachable: value }) => {
      reachable = value;
      changed();
    });
  }
  bus.on('assessments:changed', sendStatus);
  // `nextPending` is a translated name: a language change re-sends the status.
  onLanguageChange(() => sendStatus(store.assessments()));
  bus.on('emergency:open', () => {
    if (!emittingFromWatch) void startWatchMonitor();
  });
  // The phone closed the emergency: the watch closes its patient monitor (Rigel, W04).
  bus.on('emergency:close', () => {
    send(envelope('emergencyEnd', { endedAt: new Date().toISOString() }));
  });
  sendStatus(store.assessments());
}

export const watch = {
  start,
  send,
  envelope,
  /** Listens to every envelope received from the watch. Returns the unsubscribe function. */
  listen(cb: (envelope: WatchEnvelope) => void): () => void {
    listeners.add(cb);
    return () => listeners.delete(cb);
  },
  source,
  startWatchMonitor,
  /** Last 'status' envelope prepared for the watch (also when no watch is connected). */
  lastStatus: () => lastStatus,
  lastReceived: () => lastReceived,
  isReachable,
  /** Notifies on every send or receive. */
  onChange(cb: () => void): () => void {
    changeListeners.add(cb);
    return () => changeListeners.delete(cb);
  },
};

function readSnapshot(): WatchSnapshot {
  snapshot ??= takeSnapshot();
  return snapshot;
}

/** Re-renders on every watch send or receive; returns an immutable snapshot. */
export function useWatch(): WatchSnapshot {
  const subscribe = useCallback((notify: () => void) => watch.onChange(notify), []);
  return useSyncExternalStore(subscribe, readSnapshot, readSnapshot);
}
