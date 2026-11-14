// Shared contracts §1 · Versioned configuration.
// See obsidian/40 Proyecto/04 Contratos compartidos.md and haven/GLOSSARY.md. Changes only by agreement.

export type I18n = { es: string; en: string };

export type Config = {
  version: string;
  zones: Zone[];
  indicators: Indicator[];
  environments: Environment[];
  protocols: Protocol[];
};

export type Zone = {
  id: string;
  name: I18n;
  purpose: I18n; // what this part of the body does (M01)
  indicators: string[];
  /** Action that fills this zone's segment of the day (M03); `opens`: indicator id or screen id. */
  dailyAction: { text: I18n; minutes: number; opens: string };
};

export type Indicator = {
  id: string;
  name: I18n;
  zone: string;
  unit: string;
  suggestedByChallenge: boolean;
  everyHours?: number; // measurement frequency; M03 uses it for pending items
  kind: 'number' | 'category';
  /** Display labels of category values (kind 'category'), e.g. { sinus: { es: 'Sinusal', en: 'Sinus' } }. */
  categoryLabels?: Record<string, I18n>;
  green: [number, number]; // universal reference; with a baseline, personal deviation rules
  rules: Rule[]; // in order; the first one that matches sets the level
  source: string; // where green and rules come from (P01)
  environmentOverrides?: Record<string, { green?: [number, number]; rules?: Rule[] }>;
  guide: { howToMeasure: I18n; whyItMatters: I18n; whatToDo: I18n; sources: string[] }; // P02
};

export type Rule = {
  level: 'amber' | 'red';
  outside?: [number, number]; // matches if the value is outside this range
  baselineDeviation?: number; // matches if |value − median| exceeds k times the personal range
  withSymptoms?: boolean; // requires an active symptom
  sustainedMin?: number; // the condition lasts at least N minutes
  repetitions?: number; // or repeats in N consecutive readings
  categories?: string[]; // for kind 'category'
  explanation: I18n;
  actions: string[];
};
// Closing rule: a value outside green that matches no rule is amber; without a current reading, "pending".

export type EnvironmentId =
  | 'launch'
  | 'station'
  | 'transit'
  | 'lunar-orbit'
  | 'moon'
  | 'mars-orbit'
  | 'mars'
  | 'rover'
  | 'reentry';

export type Environment = {
  id: EnvironmentId | (string & {});
  name: I18n;
  gravity: number; // in g
  delayMin: number; // minutes, one way
  delayMax: number;
  blackouts: boolean;
  evacuation: boolean; // without evacuation, decisions are made on board
  dailyDoseMSv?: number; // expected reference dose
  /** One sentence: what this environment does to the body (NASA's five hazards), with its source figures. */
  description?: I18n;
  /** What HAVEN watches more closely in this environment. */
  watch?: I18n[];
  /** @deprecated Mobile M05 picker only; Earth plans missions with phases and templates. */
  destinations?: Destination[];
};

/** One stretch of a mission in a single environment (Artemis: launch → Earth orbit → cruise → …). */
export type MissionPhase = {
  environment: EnvironmentId | (string & {});
  /** Whole days; launch and reentry count as one. */
  days: number;
  /** One-way delay in this phase when the environment's range is wide (cruise to the Moon vs. to Mars). */
  delayMin?: number;
  /** Optional name of the stretch («Translunar cruise»). */
  label?: I18n;
};

/** A starting plan for a new mission (config/mission-templates.json). */
export type MissionTemplate = {
  id: string;
  name: I18n;
  /** One line for the list. */
  description: I18n;
  /** Two or three plain sentences: what happens in the mission and why it matters for health. */
  summary: I18n;
  /** The real mission or plan it follows («NASA's Artemis III plan»). */
  basedOn: I18n;
  /** Public page of that source (NASA). */
  sourceUrl: string;
  phases: MissionPhase[];
};

export type Destination = {
  id: string;
  name: I18n;
  delayMin: number;
  durationDays: number;
  image?: string;
};

export type Action = { id: string; text: I18n; priority: number; protocol?: string }; // up to three per Assessment

export type Protocol = { id: string; name: I18n; start: string; steps: Step[] };

export type Step = {
  id: string;
  text: I18n;
  audio?: I18n;
  seconds?: number;
  illustration?: string;
  onlyIn?: string[]; // environments where it applies: restraint in microgravity vs. surface
  options?: { text: I18n; next: string }[]; // triage branches; without options, "done" goes to `next`
  next?: string;
};
