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

export type SampleType = {
  id: string;
  kind: 'biological' | 'environment';
  name: I18n;
  detail: I18n;
  /** Collected on mission day `firstDay` and then every `everyDays` days. */
  everyDays: number;
  firstDay: number;
  /** Habitat modules to choose from when collecting (surface swabs). */
  modules?: { id: string; name: I18n }[];
  /** What an abnormal lab result means. */
  abnormal: I18n;
  /** Questions the app asks when the sample is collected. */
  questions: SampleQuestion[];
  /** Indicators worth seeing next to the result, read around the collection time. */
  context: string[];
  /** Days after collection beyond which the sample may no longer be reliable. */
  maxAgeDays: number;
  /** Lab values Earth enters; each one is classified against its ranges. */
  analytes: SampleAnalyte[];
};

export type SampleQuestion = {
  id: string;
  label: I18n;
  options: { id: string; label: I18n }[];
};

export type SampleAnalyte = {
  id: string;
  name: I18n;
  unit: string;
  /** Reference range: outside it the value is abnormal. */
  green: [number, number];
  /** Outside this wider range the value is critical. */
  red: [number, number];
};

export type SampleConfig = {
  /** Days after the due day before an uncollected sample counts as overdue. */
  overdueAfterDays: number;
  samples: SampleType[];
  source: string;
};
