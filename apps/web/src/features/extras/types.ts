// T03 · Form states shared by the server actions (actions.ts) and the client forms.
import type { ThresholdError } from './logic/rules';

/** Earth tool pages (`/rules`, `/trends`, `/eva`); also the old `/extras?tab=` values. */
export const EXTRAS_TABS = ['rules', 'trends', 'eva'] as const;
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
