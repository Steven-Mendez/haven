// Shared contracts §1 · Simulation scenario (P04, played by C02).

import type { Level } from './assessment';
import type { I18n } from './config';

export type Scenario = {
  id: string;
  name: I18n;
  durationMin: number;
  sources: string[];
  series: { indicator: string; points: [number, number][] }[]; // [minute, value]
  events: { minute: number; message: string; payload: object }[]; // watch messages (§4) emitted by the simulator
  expected: { zone: string; level: Level }[];
};
