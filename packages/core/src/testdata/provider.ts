import {
  type Config,
  type HealthProvider,
  type Reading,
  type Scenario,
  WATCH_CONTRACT_VERSION,
  type WatchEnvelope,
  type WatchMessages,
  type WatchMessageType,
} from '../contracts';
import { contentConfig, contentScenarios } from './config-source';
import { type EcgOptions, type EcgStrip, ecgFromReadings } from './ecg';
import { scenarioTimeline, type TimelineItem } from './scenario';
import { demoHistory } from './series';

export type Timers = {
  setTimeout(fn: () => void, ms: number): unknown;
  clearTimeout(handle: unknown): void;
};

export type SimulatorOptions = {
  crewMember: string;
  scenario?: string;
  factor?: number;
  start?: Date;
  config?: Config;
  scenarios?: Scenario[];
  timers?: Timers;
  clock?: () => number;
  history?: boolean;
};

export type PlaybackState = {
  scenario?: string;
  playing: boolean;
  minute: number;
  durationMin: number;
};

export interface SimulatorProvider extends HealthProvider {
  play(scenarioId: string): void;
  stop(): void;
  onWatchMessage(cb: (envelope: WatchEnvelope) => void): () => void;
  sendToWatch(envelope: WatchEnvelope): void;
  pressEmergency(): void;
  sendFromWatch<T extends WatchMessageType>(type: T, payload: WatchMessages[T]): void;
  lastWatchStatus(): WatchEnvelope<'status'> | undefined;
  watchInbox(): WatchEnvelope[];
  playback(): PlaybackState;
  now(): Date;
  scenarios(): Scenario[];
  latestSimulatedEcg(options?: Omit<EcgOptions, 'rhythm' | 'heartRate'>): EcgStrip;
}

const MIN_MS = 60_000;

export function createSimulator(options: SimulatorOptions): SimulatorProvider {
  const crewMember = options.crewMember;
  const factor = options.factor && options.factor > 0 ? options.factor : 1;
  const timers: Timers = options.timers ?? (globalThis as unknown as Timers);
  const clock = options.clock ?? (() => Date.now());
  const createdReal = clock();
  const simStart = options.start?.getTime() ?? createdReal;
  const config = options.config ?? contentConfig();
  const catalog = options.scenarios ?? contentScenarios();

  let history: Reading[] | undefined;
  const emitted: Reading[] = [];
  const readingListeners = new Map<string, Set<(r: Reading) => void>>();
  const watchListeners = new Set<(e: WatchEnvelope) => void>();
  const inbox: WatchEnvelope[] = [];
  let lastStatus: WatchEnvelope<'status'> | undefined;

  let timeline: TimelineItem[] = [];
  let cursor = 0;
  let handle: unknown;
  let state: PlaybackState = { playing: false, minute: 0, durationMin: 0 };
  let playStart = 0;
  let simulatedFloor = simStart;

  const now = () => new Date(Math.max(simStart + (clock() - createdReal) * factor, simulatedFloor));

  const emitReading = (r: Reading) => {
    emitted.push(r);
    for (const key of [r.indicator, '*']) {
      for (const cb of readingListeners.get(key) ?? []) cb(r);
    }
  };
  const emitWatch = (e: WatchEnvelope) => {
    for (const cb of watchListeners) cb(e);
  };

  const step = () => {
    handle = undefined;
    const item = timeline[cursor];
    if (!item) return;
    const minute = item.minute;
    while (cursor < timeline.length && (timeline[cursor] as TimelineItem).minute <= minute) {
      const x = timeline[cursor] as TimelineItem;
      cursor++;
      if (x.reading) emitReading(x.reading);
      if (x.envelope) emitWatch(x.envelope);
    }
    state = { ...state, minute };
    simulatedFloor = Math.max(simulatedFloor, playStart + minute * MIN_MS);
    scheduleNext(minute);
  };

  const scheduleNext = (fromMinute: number) => {
    const next = timeline[cursor];
    if (!next) {
      state = { ...state, playing: false, minute: state.durationMin };
      return;
    }
    const delay = Math.max(0, ((next.minute - fromMinute) * MIN_MS) / factor);
    handle = timers.setTimeout(step, delay);
  };

  const stop = () => {
    if (handle !== undefined) timers.clearTimeout(handle);
    handle = undefined;
    state = { ...state, playing: false };
  };

  const provider: SimulatorProvider = {
    id: 'simulator',
    isAvailable: async () => true,
    read: async (indicator, since) => {
      if (options.history !== false && !history) {
        history = demoHistory(crewMember, new Date(simStart), { config });
      }
      const from = new Date(since).getTime();
      return [...(history ?? []), ...emitted]
        .filter((r) => r.indicator === indicator && new Date(r.takenAt).getTime() >= from)
        .sort((a, b) => a.takenAt.localeCompare(b.takenAt));
    },
    subscribe: (indicator, cb) => {
      const set = readingListeners.get(indicator) ?? new Set();
      set.add(cb);
      readingListeners.set(indicator, set);
      return () => set.delete(cb);
    },
    play: (scenarioId) => {
      stop();
      const scenario = catalog.find((s) => s.id === scenarioId);
      if (!scenario) throw new Error(`Unknown scenario: ${scenarioId}`);
      playStart = now().getTime();
      timeline = scenarioTimeline(scenario, crewMember, new Date(playStart), { config });
      cursor = 0;
      state = { scenario: scenarioId, playing: true, minute: 0, durationMin: scenario.durationMin };
      scheduleNext(0);
    },
    stop,
    onWatchMessage: (cb) => {
      watchListeners.add(cb);
      return () => watchListeners.delete(cb);
    },
    sendToWatch: (envelope) => {
      inbox.push(envelope);
      if (envelope.type === 'status') lastStatus = envelope as WatchEnvelope<'status'>;
    },
    pressEmergency: () => {
      provider.sendFromWatch('emergency', { origin: 'button', takenAt: now().toISOString() });
    },
    sendFromWatch: (type, payload) => {
      emitWatch({
        v: WATCH_CONTRACT_VERSION,
        type,
        crewMember,
        simulated: false,
        sentAt: now().toISOString(),
        payload,
      });
    },
    lastWatchStatus: () => lastStatus,
    watchInbox: () => [...inbox],
    playback: () => ({ ...state }),
    now,
    scenarios: () => [...catalog],
    latestSimulatedEcg: (ecgOptions) => {
      const at = now();
      const pick = (id: string) => {
        const live = emitted.filter((r) => r.indicator === id);
        if (live.length > 0) return live;
        if (options.history === false) return [];
        history ??= demoHistory(crewMember, new Date(simStart), { config });
        return history.filter((r) => r.indicator === id);
      };
      return ecgFromReadings([...pick('heart-rhythm'), ...pick('heart-rate')], {
        ...ecgOptions,
        now: at,
        crewMember,
      });
    },
  };

  if (options.scenario) provider.play(options.scenario);
  return provider;
}
