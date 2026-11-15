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

/** NASA RIDGE hazard of human spaceflight. */
export type RidgeHazard = 'radiation' | 'isolation' | 'distance' | 'gravity' | 'environment';

export type Indicator = {
  id: string;
  name: I18n;
  zone: string;
  unit: string;
  inputs: IndicatorInput[];
  suggestedByChallenge: boolean;
  /** RIDGE hazards the indicator watches; the first one is the main one. */
  ridge: RidgeHazard[];
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

export type MedicationSchedule =
  | { kind: 'daily'; times: string[] }
  | { kind: 'weekly'; weekday: number; times: string[] }
  | { kind: 'as-needed'; maxPerDay: number };

export type Medication = {
  id: string;
  name: I18n;
  purpose: I18n;
  instructions: I18n;
  /** Default schedule; times are mission time (UTC), HH:MM. Weekday 0 is Sunday. */
  schedule: MedicationSchedule;
};

export type ExerciseKind = 'resistance' | 'aerobic';

/** Daily minutes of each kind and training days a week; Earth can change it per crew member. */
export type ExercisePrescription = {
  resistanceMinutes: number;
  aerobicMinutes: number;
  daysPerWeek: number;
  note?: string;
};

export type ExerciseDevice = { id: string; kind: ExerciseKind; name: I18n };

export type ExerciseConfig = {
  /** Default prescription when Earth has not set one. */
  prescription: ExercisePrescription;
  limits: {
    minutes: [number, number];
    daysPerWeek: [number, number];
    sessionMinutes: [number, number];
  };
  devices: ExerciseDevice[];
  /** Weekly self-assessment; effort is perceived exertion on a 0–10 scale. */
  assessment: { everyDays: number; easyEffort: number; hardEffort: number };
  source: string;
};

export type MedicationConfig = {
  /** Hours after the scheduled time during which a dose is still due, not missed. */
  doseWindowHours: number;
  /** How long before its time a scheduled dose can already be logged. */
  earlyHours: number;
  catalog: Medication[];
  source: string;
};
