// Shared contracts §5 · Evaluated assessment (was "Estado").

import type { Action, I18n } from './config';

export type Level = 'green' | 'amber' | 'red' | 'pending';

export type Assessment = {
  indicator: string;
  level: Level;
  value?: number;
  baseline?: { median: number; range: [number, number] };
  explanation: I18n; // why this level, in plain language
  actions: Action[]; // up to three, prioritized
  ageMin: number;
  simulated: boolean;
};
