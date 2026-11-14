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

/** Injectable timers (tests pass fakes; default: global setTimeout/clearTimeout). */
export type Timers = {
  setTimeout(fn: () => void, ms: number): unknown;
  clearTimeout(handle: unknown): void;
};

export type SimulatorOptions = {
  crewMember: string;
  /** Scenario to start playing right away. */
  scenario?: string;
  /** Speed: 1 = real time, 60 = one simulated minute per real second. Default 1. */
  factor?: number;
  /** Simulated instant at creation (default: now). History ends here. */
  start?: Date;
  /** Config used for units, cadences and nominal ranges (default: Content's `loadConfig()`). */
  config?: Config;
  /** Scenario catalog (default: Content's `scenarios`). */
  scenarios?: Scenario[];
  timers?: Timers;
  /** Real clock in ms (default Date.now); only used to derive the simulated time. */
  clock?: () => number;
  /** Include 30 days of `demoHistory` in `read()` (default true). */
  history?: boolean;
};

export type PlaybackState = {
  scenario?: string;
  playing: boolean;
  /** Last simulated minute emitted. */
  minute: number;
  durationMin: number;
};

export interface SimulatorProvider extends HealthProvider {
  /** Plays a scenario from the current simulated time (stops the previous one). */
  play(scenarioId: string): void;
  stop(): void;
  /** Watch → phone messages from the watch simulator. Returns the unsubscribe function. */
  onWatchMessage(cb: (envelope: WatchEnvelope) => void): () => void;
  /** Phone → watch message; the simulator stores it (and the last `status`). */
  sendToWatch(envelope: WatchEnvelope): void;
  /** Simulated watch SOS button: emits `emergency { origin: 'button' }`. */
  pressEmergency(): void;
  /** Sends any watch → phone message from the simulated watch (dev panel). */
  sendFromWatch<T extends WatchMessageType>(type: T, payload: WatchMessages[T]): void;
  lastWatchStatus(): WatchEnvelope<'status'> | undefined;
  /** Messages the phone sent to the simulated watch, oldest first. */
  watchInbox(): WatchEnvelope[];
  playback(): PlaybackState;
  /** Current simulated time. */
  now(): Date;
  scenarios(): Scenario[];
  /**
   * Simulated ECG strip for the emergency packet, using the rhythm and heart rate of the active
   * scenario (latest emitted readings, else the demo history) at the current simulated time.
   */
  latestSimulatedEcg(options?: Omit<EcgOptions, 'rhythm' | 'heartRate'>): EcgStrip;
}

const MIN_MS = 60_000;

/**
 * Simulated `HealthProvider` (C02). Serves 30 days of `demoHistory` plus whatever the playing
 * scenario has emitted; `subscribe(indicator | '*', cb)` delivers scenario readings live. Includes the
 * watch simulator: scenario watch events and `pressEmergency()` arrive through `onWatchMessage`,
 * with `simulated: false`: every record looks like a real one (test data, dev tools only).
 */
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
  /** Simulated offset added by scenario playback when the real clock is not advanced (fake timers). */
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
