import {
  type Assessment,
  overallLevel,
  readingsFromEnvelope,
  WATCH_CONTRACT_VERSION,
  type WatchEnvelope,
  type WatchMessages,
  type WatchMessageType,
  type WatchSession,
} from '@haven/core';
import { type EventSubscription, requireOptionalNativeModule } from 'expo';
import { useCallback, useSyncExternalStore } from 'react';
import { config } from '@/shared/config';
import { store } from '@/shared/data';
import { bus } from '@/shared/events';
import { currentLanguage, onLanguageChange } from '@/shared/i18n';

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

const native = requireOptionalNativeModule<HavenWatchModule>('HavenWatch');

let emittingFromWatch = false;

const HEARD_RECENTLY_MS = 2 * 60_000;
let lastReceivedAt = 0;

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

function changed() {
  snapshot = takeSnapshot();
  if (notifyScheduled) return;
  notifyScheduled = true;
  queueMicrotask(() => {
    notifyScheduled = false;
    for (const fn of changeListeners) fn();
  });
}

function receive(envelope: WatchEnvelope) {
  if (!envelope || envelope.v !== WATCH_CONTRACT_VERSION) {
    console.warn('[watch] envelope with unknown version', envelope);
    return;
  }
  lastReceived = envelope;
  lastReceivedAt = Date.now();
  if (session() !== 'active') {
    sendStatus(store.assessments());
    changed();
    return;
  }
  if (envelope.type === 'emergency') {
    const payload = envelope.payload as WatchMessages['emergency'];
    emittingFromWatch = true;
    try {
      bus.emit('emergency:open', { origin: payload.origin });
    } finally {
      emittingFromWatch = false;
    }
  }
  const readings = readingsFromEnvelope({
    ...envelope,
    crewMember: envelope.crewMember || store.preferences().crewMember,
  }).map((r) => ({ ...r, simulated: false }));
  if (readings.length > 0) void store.saveReadings(readings);
  for (const listener of listeners) listener(envelope);
  changed();
}

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

function session(): WatchSession {
  if (!store.preferences().joined) return 'signedOut';
  const { status } = store.mission();
  if (status === 'planned' || status === 'scheduled') return 'waiting';
  return status === 'finished' ? 'signedOut' : 'active';
}

function sendStatus(assessments: Assessment[]) {
  const pending = assessments.find((a) => a.level === 'pending');
  const nextPending = pending
    ? (config.indicators.find((i) => i.id === pending.indicator)?.name[currentLanguage()] ??
      pending.indicator)
    : undefined;
  const level = overallLevel(assessments);
  const language = currentLanguage();
  const state = session();
  const sig = `${level}|${nextPending ?? ''}|${language}|${state}`;
  if (sig === sentSignature) return;
  sentSignature = sig;
  send(
    envelope('status', {
      overallLevel: level,
      nextPending,
      evaluatedAt: new Date().toISOString(),
      language,
      session: state,
    }),
  );
}

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
  onLanguageChange(() => sendStatus(store.assessments()));
  bus.on('mission:changed', () => sendStatus(store.assessments()));
  store.subscribe('preferences', () => sendStatus(store.assessments()));
  bus.on('emergency:open', () => {
    if (!emittingFromWatch) void startWatchMonitor();
  });
  bus.on('emergency:close', () => {
    send(envelope('emergencyEnd', { endedAt: new Date().toISOString() }));
  });
  sendStatus(store.assessments());
}

export const watch = {
  start,
  send,
  envelope,
  listen(cb: (envelope: WatchEnvelope) => void): () => void {
    listeners.add(cb);
    return () => listeners.delete(cb);
  },
  source,
  startWatchMonitor,
  lastStatus: () => lastStatus,
  lastReceived: () => lastReceived,
  isReachable,
  onChange(cb: () => void): () => void {
    changeListeners.add(cb);
    return () => changeListeners.delete(cb);
  },
};

function readSnapshot(): WatchSnapshot {
  snapshot ??= takeSnapshot();
  return snapshot;
}

export function useWatch(): WatchSnapshot {
  const subscribe = useCallback((notify: () => void) => watch.onChange(notify), []);
  return useSyncExternalStore(subscribe, readSnapshot, readSnapshot);
}
