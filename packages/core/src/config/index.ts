import actionsJson from '../../config/actions.json';
import environments from '../../config/environments.json';
import evaJson from '../../config/eva.json';
import glossaryJson from '../../config/glossary.json';
import guides from '../../config/guides.json';
import indicators from '../../config/indicators.json';
import medicationsJson from '../../config/medications.json';
import templatesJson from '../../config/mission-templates.json';
import protocols from '../../config/protocols.json';
import reentryJson from '../../config/reentry.json';
import samplesJson from '../../config/samples.json';
import symptomsJson from '../../config/symptoms.json';
import unitsJson from '../../config/units.json';
import version from '../../config/version.json';
import zones from '../../config/zones.json';
import type {
  Action,
  Config,
  Environment,
  EvaConfig,
  I18n,
  Indicator,
  MedicationConfig,
  MissionPhase,
  MissionTemplate,
  ReentryConfig,
  SampleConfig,
} from '../contracts';

type IndicatorWithoutGuide = Omit<Indicator, 'guide'>;

export const SYMPTOM_INDICATOR = 'symptom';

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
  'joint-pain',
] as const;

export type SymptomId = (typeof SYMPTOMS)[number];

export type Symptom = { id: SymptomId; name: I18n; description?: I18n };

export const symptoms: Symptom[] = symptomsJson as Symptom[];

export function symptomById(id: string): Symptom | undefined {
  return symptoms.find((s) => s.id === id);
}

export const units: Record<string, I18n> = unitsJson as Record<string, I18n>;

export function unitLabel(unit: string, lang: 'es' | 'en'): string {
  return units[unit]?.[lang] ?? unit;
}

export type GlossaryEntry = {
  term: I18n;
  short: I18n;
  unitHint?: I18n;
};

export type ExplainedTerm = { term: string; short: string; unitHint?: string };

export const glossary: Record<string, GlossaryEntry> = glossaryJson as Record<
  string,
  GlossaryEntry
>;

export function explainTerm(id: string, lang: 'es' | 'en'): ExplainedTerm | undefined {
  const entry = Object.hasOwn(glossary, id) ? glossary[id] : undefined;
  if (!entry) return undefined;
  return {
    term: entry.term[lang],
    short: entry.short[lang],
    ...(entry.unitHint ? { unitHint: entry.unitHint[lang] } : {}),
  };
}

export const DAILY_ACTION_SCREENS = ['cognition', 'wellbeing', 'routine'] as const;

const emptyGuide: Indicator['guide'] = {
  howToMeasure: { es: '', en: '' },
  whyItMatters: { es: '', en: '' },
  whatToDo: { es: '', en: '' },
  sources: [],
};

export const actions: Action[] = actionsJson as Action[];

export function actionById(id: string): Action | undefined {
  return actions.find((a) => a.id === id);
}

export const reentry: ReentryConfig = reentryJson as ReentryConfig;
export const eva: EvaConfig = evaJson as EvaConfig;
export const medications: MedicationConfig = medicationsJson as MedicationConfig;
export const sampleConfig: SampleConfig = samplesJson as SampleConfig;

export type LoadedConfig = Config & { actions: Action[] };

export const EXTRA_INDICATORS: readonly string[] = (indicators as IndicatorWithoutGuide[])
  .filter((i) => i.extra)
  .map((i) => i.id);

export function isTracked(indicator: string): boolean {
  return !EXTRA_INDICATORS.includes(indicator);
}

export function loadConfig(options?: { includeExtras?: boolean }): LoadedConfig {
  const guidesById = guides as Record<string, Indicator['guide']>;
  const kept = (id: string) => options?.includeExtras || isTracked(id);
  return {
    version: version.version,
    zones: (zones as Config['zones']).map((z) => ({
      ...z,
      indicators: z.indicators.filter(kept),
    })),
    environments: environments as Config['environments'],
    protocols: protocols as Config['protocols'],
    indicators: (indicators as IndicatorWithoutGuide[])
      .filter((i) => kept(i.id))
      .map((i) => ({ ...i, guide: guidesById[i.id] ?? emptyGuide })),
    actions,
  };
}

const isRange = (v: unknown): v is [number, number] =>
  Array.isArray(v) && v.length === 2 && v.every((n) => typeof n === 'number' && Number.isFinite(n));

export function rebaseConfig<T extends Config>(base: T, received: unknown): T {
  const r = received as Partial<Config> | null | undefined;
  if (!r || typeof r !== 'object' || !Array.isArray(r.indicators)) return base;
  const sent = new Map<string, Partial<Indicator>>();
  for (const i of r.indicators) {
    if (i && typeof i === 'object' && typeof i.id === 'string') sent.set(i.id, i);
  }
  return {
    ...base,
    version: typeof r.version === 'string' && r.version ? r.version : base.version,
    indicators: base.indicators.map((i) => {
      const s = sent.get(i.id);
      if (!s || s.kind !== i.kind) return i;
      return {
        ...i,
        green: isRange(s.green) ? [s.green[0], s.green[1]] : i.green,
        rules: Array.isArray(s.rules) ? s.rules : i.rules,
      };
    }),
  };
}

export const missionTemplates: MissionTemplate[] = templatesJson as MissionTemplate[];

export function missionDays(phases: MissionPhase[]): number {
  return phases.reduce((n, p) => n + Math.max(0, p.days), 0);
}

export type PhaseAt = { index: number; phase: MissionPhase; startDay: number; endDay: number };

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

export function phaseDelay(
  phase: MissionPhase,
  environment: Pick<Environment, 'delayMin' | 'delayMax'> | undefined,
): number {
  if (!environment) return phase.delayMin ?? 0;
  const low = Math.min(environment.delayMin, environment.delayMax);
  const high = Math.max(environment.delayMin, environment.delayMax);
  return Math.min(high, Math.max(low, phase.delayMin ?? environment.delayMin));
}
