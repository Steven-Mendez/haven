// Shared contracts §2 and §3 · Reading and the single health data interface.

export type ReadingSource =
  | 'watch'
  | 'healthkit'
  | 'healthconnect'
  | 'ble'
  | 'manual'
  | 'screen'
  | 'simulator'
  | 'ship'; // habitat telemetry and solar events

export type Reading = {
  id: string;
  indicator: string;
  value: number | string;
  unit: string;
  takenAt: string; // ISO 8601
  source: ReadingSource;
  simulated: boolean;
  crewMember: string;
  note?: string;
};

export interface HealthProvider {
  id: string;
  isAvailable(): Promise<boolean>;
  read(indicator: string, since: string): Promise<Reading[]>;
  subscribe(indicator: string, cb: (reading: Reading) => void): () => void; // live monitor
}
