// Shared contracts §4 · Watch–phone contract (WatchConnectivity, JSON).
// The Swift mirror lives in apps/mobile/targets/watch/Contract/Contract.swift: keep both identical.

import type { Level } from './assessment';

export const WATCH_CONTRACT_VERSION = 1;

export type WatchMessages = {
  status: {
    overallLevel: Level;
    nextPending?: string;
    evaluatedAt: string;
    language?: 'es' | 'en';
  };
  mood: { score: 1 | 2 | 3 | 4 | 5; takenAt: string };
  /**
   * `heartRate` / `spo2` + `readingAt`: the reading that fired an automatic trigger (heartRate, spo2), so the
   * value that raised the alarm travels to Earth. Absent for button, fall and rhythm.
   */
  emergency: {
    origin: 'button' | 'fall' | 'heartRate' | 'rhythm' | 'spo2';
    takenAt: string;
    heartRate?: number;
    spo2?: number;
    readingAt?: string;
  };
  monitor: { heartRate: number; takenAt: string; spo2?: number; spo2TakenAt?: string };
  crewHaptic: { message: string };
  /** Phone → watch: the emergency was closed on the phone; the watch stops the patient monitor. */
  emergencyEnd: { endedAt: string };
};

export type WatchMessageType = keyof WatchMessages;

export type WatchEnvelope<T extends WatchMessageType = WatchMessageType> = {
  v: typeof WATCH_CONTRACT_VERSION;
  type: T;
  crewMember: string;
  simulated: boolean;
  sentAt: string;
  payload: WatchMessages[T];
};
