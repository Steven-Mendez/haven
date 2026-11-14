import type { Action, I18n } from './config';

export type Level = 'green' | 'amber' | 'red' | 'pending';

export type Assessment = {
  indicator: string;
  level: Level;
  value?: number;
  baseline?: { median: number; range: [number, number] };
  explanation: I18n;
  actions: Action[];
  ageMin: number;
  simulated: boolean;
};
