import type { Level } from './assessment';

export const WATCH_CONTRACT_VERSION = 1;

export type WatchSession = 'active' | 'waiting' | 'signedOut';

export type WatchMessages = {
  status: {
    overallLevel: Level;
    nextPending?: string;
    evaluatedAt: string;
    language?: 'es' | 'en';
    session?: WatchSession;
  };
  mood: { score: 1 | 2 | 3 | 4 | 5; takenAt: string };
  emergency: {
    origin: 'button' | 'fall' | 'heartRate' | 'rhythm' | 'spo2';
    takenAt: string;
    heartRate?: number;
    spo2?: number;
    readingAt?: string;
  };
  monitor: { heartRate: number; takenAt: string; spo2?: number; spo2TakenAt?: string };
  crewHaptic: { message: string };
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
