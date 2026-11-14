export type ReadingSource =
  | 'watch'
  | 'healthkit'
  | 'healthconnect'
  | 'ble'
  | 'manual'
  | 'screen'
  | 'simulator'
  | 'ship'
  | 'phone';

export type Reading = {
  id: string;
  indicator: string;
  value: number | string;
  unit: string;
  takenAt: string;
  source: ReadingSource;
  simulated: boolean;
  crewMember: string;
  note?: string;
};

export interface HealthProvider {
  id: string;
  isAvailable(): Promise<boolean>;
  read(indicator: string, since: string): Promise<Reading[]>;
  subscribe(indicator: string, cb: (reading: Reading) => void): () => void;
}
