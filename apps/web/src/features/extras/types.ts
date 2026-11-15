import type { ThresholdError } from './logic/rules';

export const EXTRAS_TABS = ['rules', 'kpi', 'eva', 'reentry'] as const;
export type ExtrasTab = (typeof EXTRAS_TABS)[number];

export type RulesFormState =
  | { status: 'idle' }
  | { status: 'error'; errors: ThresholdError[]; message?: 'mission' | 'save' | 'engine' }
  | { status: 'ok'; version: string; at: number };

export type MissionField = 'name' | 'phases' | 'start';

export type MissionFormState =
  | { status: 'idle' }
  | { status: 'error'; fields: MissionField[]; message?: 'create' }
  | { status: 'ok'; code: string; name: string; at: number };

export type JoinFormState =
  | { status: 'idle' }
  | { status: 'error'; code: 'format' | 'unknown'; value: string };
