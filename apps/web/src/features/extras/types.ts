import type { ThresholdError } from './logic/rules';

export const EXTRAS_TABS = [
  'rules',
  'kpi',
  'eva',
  'reentry',
  'medication',
  'samples',
  'exercise',
  'motion',
  'workload',
] as const;
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

export type ExerciseFormState =
  | { status: 'idle' }
  | { status: 'error'; crewMember: string }
  | { status: 'ok'; crewMember: string; at: number };

export type MedicationFormState =
  | { status: 'idle' }
  | { status: 'error'; crewMember: string }
  | { status: 'ok'; crewMember: string; at: number };

export type SampleResultFormState =
  | { status: 'idle' }
  | { status: 'error'; id: string }
  | { status: 'ok'; id: string; at: number };
