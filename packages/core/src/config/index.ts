import actionsJson from '../../config/actions.json';
import environments from '../../config/environments.json';
import glossaryJson from '../../config/glossary.json';
import guides from '../../config/guides.json';
import indicators from '../../config/indicators.json';
import templatesJson from '../../config/mission-templates.json';
import protocols from '../../config/protocols.json';
import symptomsJson from '../../config/symptoms.json';
import unitsJson from '../../config/units.json';
import version from '../../config/version.json';
import zones from '../../config/zones.json';
import type {
  Action,
  Config,
  Environment,
  I18n,
  Indicator,
  MissionPhase,
  MissionTemplate,
} from '../contracts';

type IndicatorWithoutGuide = Omit<Indicator, 'guide'>;

/** Indicator id used by symptom readings (`source: 'screen'`, categorical `value`). */
export const SYMPTOM_INDICATOR = 'symptom';

/** Symptom values a `symptom` reading can carry (documented in config/README.md). */
export const SYMPTOMS = [
  'chest-pain',
  'shortness-of-breath',
  'dizziness',
  'fainting',
  'blurred-vision',
  'confusion',
  'nausea',
  'fever-chills',
  'sweating',
  'palpitations',
] as const;

export type SymptomId = (typeof SYMPTOMS)[number];

/** A symptom with its user-facing name (config/symptoms.json). Not part of `Config`. */
export type Symptom = { id: SymptomId; name: I18n; description?: I18n };

/** Symptom names and plain-language descriptions, in the same order as `SYMPTOMS`. */
export const symptoms: Symptom[] = symptomsJson as Symptom[];

/** Looks up a symptom by id. */
export function symptomById(id: string): Symptom | undefined {
  return symptoms.find((s) => s.id === id);
}

/** User-facing labels for each `Indicator.unit` id (config/units.json). */
export const units: Record<string, I18n> = unitsJson as Record<string, I18n>;

/** Unit label in the given language; returns the unit id itself when it has no label. */
export function unitLabel(unit: string, lang: 'es' | 'en'): string {
  return units[unit]?.[lang] ?? unit;
}

/** A plain-language explanation of a term for tooltips (config/glossary.json). Not part of `Config`. */
export type GlossaryEntry = {
  /** Plain label, e.g. «Presión al latir (sistólica)». */
  term: I18n;
  /** One jargon-free sentence (≤ 100 characters): what it is and why it matters in space. */
  short: I18n;
  /** What the unit means, when the term has one. */
  unitHint?: I18n;
};

/** A glossary entry resolved to one language. */
export type ExplainedTerm = { term: string; short: string; unitHint?: string };

/** Glossary keyed by indicator id, zone id or UI term id (`baseline`, `level-amber`, `ecg`…). */
export const glossary: Record<string, GlossaryEntry> = glossaryJson as Record<
  string,
  GlossaryEntry
>;

/** Plain-language explanation of a term in the given language; `undefined` when it is not in the glossary. */
export function explainTerm(id: string, lang: 'es' | 'en'): ExplainedTerm | undefined {
  const entry = Object.hasOwn(glossary, id) ? glossary[id] : undefined;
  if (!entry) return undefined;
  return {
    term: entry.term[lang],
    short: entry.short[lang],
    ...(entry.unitHint ? { unitHint: entry.unitHint[lang] } : {}),
  };
}

/** Screen ids that `Zone.dailyAction.opens` may name besides an indicator id. */
export const DAILY_ACTION_SCREENS = ['cognition', 'wellbeing', 'routine'] as const;

const emptyGuide: Indicator['guide'] = {
  howToMeasure: { es: '', en: '' },
  whyItMatters: { es: '', en: '' },
  whatToDo: { es: '', en: '' },
  sources: [],
};

/** Catalog of action ids used by `Rule.actions` (not part of `Config`; see config/README.md). */
export const actions: Action[] = actionsJson as Action[];

/** Looks up an action by id. */
export function actionById(id: string): Action | undefined {
  return actions.find((a) => a.id === id);
}

/** Config plus the action catalog. Still assignable to `Config`. */
export type LoadedConfig = Config & { actions: Action[] };

/** Joins the config/ files into one versioned tree. */
export function loadConfig(): LoadedConfig {
  const guidesById = guides as Record<string, Indicator['guide']>;
  return {
    version: version.version,
    zones: zones as Config['zones'],
    environments: environments as Config['environments'],
    protocols: protocols as Config['protocols'],
    indicators: (indicators as IndicatorWithoutGuide[]).map((i) => ({
      ...i,
      guide: guidesById[i.id] ?? emptyGuide,
    })),
    actions,
  };
}

// ─── Mission phases ─────────────────────────────────────────────────────────────────────────────────

/** Starting plans for a new mission (config/mission-templates.json). Not part of `Config`. */
export const missionTemplates: MissionTemplate[] = templatesJson as MissionTemplate[];

/** Total days of a phase plan. */
export function missionDays(phases: MissionPhase[]): number {
  return phases.reduce((n, p) => n + Math.max(0, p.days), 0);
}

/** A phase located on the mission calendar: `startDay`…`endDay` are 1-based and inclusive. */
export type PhaseAt = { index: number; phase: MissionPhase; startDay: number; endDay: number };

/**
 * Phase of a mission day (1-based). Before day 1 it is the first phase, after the plan the last one
 * (the crew is still monitored); `undefined` only without phases.
 */
export function phaseAt(phases: MissionPhase[], day: number): PhaseAt | undefined {
  let start = 1;
  for (const [index, phase] of phases.entries()) {
    const end = start + Math.max(1, phase.days) - 1;
    if (day <= end || index === phases.length - 1)
      return { index, phase, startDay: start, endDay: end };
    start = end + 1;
  }
  return undefined;
}

/** One-way delay of a phase: its own `delayMin`, else the environment's, kept inside the environment range. */
export function phaseDelay(
  phase: MissionPhase,
  environment: Pick<Environment, 'delayMin' | 'delayMax'> | undefined,
): number {
  if (!environment) return phase.delayMin ?? 0;
  const low = Math.min(environment.delayMin, environment.delayMax);
  const high = Math.max(environment.delayMin, environment.delayMax);
  return Math.min(high, Math.max(low, phase.delayMin ?? environment.delayMin));
}
