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

/** One step of the 0–10 motion sickness scale (MISC). */
export type MotionScaleStep = { score: number; label: I18n };

export type HeadMovementStep = { id: string; seconds: number; title: I18n; body: I18n };

export type MotionConfig = {
  /** Days after launch or a gravity change in which the scale is asked every day. */
  windowDays: number;
  scale: MotionScaleStep[];
  /** Lowest score of each level: amber from `amber`, red from `red`. */
  levels: { amber: number; red: number };
  headMovements: HeadMovementStep[];
  /** Balance test: seconds per stance and sway thresholds (mg, eyes closed). */
  balance: { seconds: number; amberSway: number; redSway: number; amberRatio: number };
  source: string;
};

export type WorkloadConfig = {
  /** Samn-Perelli fatigue scale, 1 (fully alert) to 7 (completely exhausted). */
  fatigueScale: { score: number; label: I18n }[];
  /** Lowest fatigue of each level. */
  fatigue: { amber: number; red: number };
  /** Hours of a long day, the daily maximum and the most a rest day can have. */
  day: { long: number; max: number; rest: number };
  /** Weekly hours of each level, rest days needed in 7 and long days in a row that warn. */
  week: { amber: number; red: number; minRestDays: number; longStreak: number };
  /** Hours of sleep under which high fatigue turns red. */
  shortSleep: number;
  source: string;
};

export type CommsConfig = {
  /** Up to this one-way delay (minutes) a conversation still feels live. */
  realtimeMaxMin: number;
  /** From this one-way delay (minutes) the crew acts on its own and Earth supports later. */
  autonomousFromMin: number;
  source: string;
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

export type ReentryCheckItem = { id: string; name: I18n; detail: I18n };

export type ReentryConfig = {
  /** How far back the preparation readings count, in hours. */
  windowHours: number;
  checklist: ReentryCheckItem[];
  orthostatic: {
    supineSeconds: number;
    standingSeconds: number;
    /** Heart-rate rise on standing, in bpm, that turns the test amber. */
    amberRise: number;
    /** Heart-rate rise on standing, in bpm, that turns the test red. */
    redRise: number;
    /** Symptoms that turn the test red when they appear while standing. */
    symptoms: string[];
  };
  source: string;
};

export type PrebreatheMethod = {
  id: string;
  name: I18n;
  detail: I18n;
  /** Minimum prebreathe time, in minutes, before the EVA can start. */
  minutes: number;
  environments: string[];
};

export type EvaConfig = {
  /** How far back the EVA readings count, in hours. */
  windowHours: number;
  methods: PrebreatheMethod[];
  postEva: { symptoms: string[]; protocol: string };
  source: string;
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
