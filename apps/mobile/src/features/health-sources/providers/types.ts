import type { HealthProvider, Reading } from '@haven/core';
import type { SourceStatus } from '../logic/sources';

/** A `HealthProvider` (contracts §3) plus what the "Data sources" screen needs. */
export type SourceProvider = HealthProvider & {
  /** Current state; refreshed by `refresh()`. */
  status(): SourceStatus;
  /** Re-checks availability and permission without prompting. */
  refresh(): Promise<SourceStatus>;
  /** Shows the system permission prompt (explicit, from the screen). */
  requestPermission?(): Promise<SourceStatus>;
  /** New readings since the last sync, for the current crew member. */
  sync?(crewMember: string, now: Date): Promise<Reading[]>;
  /** Development only (`__DEV__`): writes test records into the platform store. Returns how many. */
  writeTestSamples?(now: Date): Promise<number>;
  /** Forgets what was synced (after "Delete data"): the next sync reads the full window again. */
  resetSync?(): void;
  /** Calls `onChange` when the platform reports new data. Returns the unsubscribe function. */
  watchChanges?(onChange: () => void): () => void;
};
