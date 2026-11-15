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
  purpose: I18n;
  indicators: string[];
  dailyAction: { text: I18n; minutes: number; opens: string };
};

export type IndicatorInput = 'watch' | 'health' | 'phone' | 'test' | 'check-in' | 'manual';

export type Indicator = {
  id: string;
  name: I18n;
  zone: string;
  unit: string;
  inputs: IndicatorInput[];
  suggestedByChallenge: boolean;
  extra?: boolean;
  everyHours?: number;
  kind: 'number' | 'category';
  categoryLabels?: Record<string, I18n>;
  green: [number, number];
  rules: Rule[];
  source: string;
  environmentOverrides?: Record<string, { green?: [number, number]; rules?: Rule[] }>;
  guide: { howToMeasure: I18n; whyItMatters: I18n; whatToDo: I18n; sources: string[] };
};

export type Rule = {
  level: 'amber' | 'red';
  outside?: [number, number];
  baselineDeviation?: number;
  withSymptoms?: boolean;
  sustainedMin?: number;
  repetitions?: number;
  categories?: string[];
  explanation: I18n;
  actions: string[];
};

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
  gravity: number;
  delayMin: number;
  delayMax: number;
  blackouts: boolean;
  evacuation: boolean;
  dailyDoseMSv?: number;
  description?: I18n;
  watch?: I18n[];
  destinations?: Destination[];
};

export type MissionPhase = {
  environment: EnvironmentId | (string & {});
  days: number;
  delayMin?: number;
  label?: I18n;
};

export type MissionTemplate = {
  id: string;
  name: I18n;
  description: I18n;
  summary: I18n;
  basedOn: I18n;
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

export type Action = { id: string; text: I18n; priority: number; protocol?: string };

export type Protocol = { id: string; name: I18n; start: string; steps: Step[] };

export type Step = {
  id: string;
  text: I18n;
  audio?: I18n;
  seconds?: number;
  illustration?: string;
  onlyIn?: string[];
  options?: { text: I18n; next: string }[];
  next?: string;
};
