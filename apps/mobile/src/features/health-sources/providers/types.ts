import type { HealthProvider, Reading } from '@haven/core';
import type { SourceStatus } from '../logic/sources';

export type SourceProvider = HealthProvider & {
  status(): SourceStatus;
  refresh(): Promise<SourceStatus>;
  requestPermission?(): Promise<SourceStatus>;
  sync?(crewMember: string, now: Date): Promise<Reading[]>;
  writeTestSamples?(now: Date): Promise<number>;
  resetSync?(): void;
  watchChanges?(onChange: () => void): () => void;
};
