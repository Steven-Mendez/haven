import type { Level } from './assessment';
import type { I18n } from './config';

export type Scenario = {
  id: string;
  name: I18n;
  durationMin: number;
  sources: string[];
  series: { indicator: string; points: [number, number][] }[];
  events: { minute: number; message: string; payload: object }[];
  expected: { zone: string; level: Level }[];
};
