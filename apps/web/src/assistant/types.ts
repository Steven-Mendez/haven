import type { InferUITools, UIDataTypes, UIMessage } from 'ai';
import type { KpiIndicatorInfo, KpiMarker, KpiSource } from '@/features/extras/logic/kpi';
import type { Language } from '@/lib/i18n';
import type { KpiPanel, KpiRange, KpiSeriesData } from '@/lib/kpi';
import type { createAssistantTools } from './server/tools';
import type { WriteTools } from './server/writes';

export type AssistantContext = {
  /** Mission chosen in the sidebar; every tool works on it unless it takes a code. */
  mission: string | null;
  lang: Language;
  /** Who signs what the assistant sends to the crew. */
  author: string;
};

/** A chart, stat, gauge or table the chat draws with the KPI components. */
export type PanelView = {
  panel: KpiPanel;
  range: KpiRange;
  indicators: KpiIndicatorInfo[];
  sources: KpiSource[];
  series: KpiSeriesData;
  markers: KpiMarker[];
  /** Latest day with data among the panel's series: the window ends here. */
  end: string | null;
};

/** A chart Orion builds from numbers it already has, for views the console does not offer. */
export type ChartSpec = {
  type: 'bars' | 'lines' | 'area' | 'scatter' | 'donut';
  title: string;
  /** Labels along the axis, or the slices of a donut; empty for a scatter. */
  categories: string[];
  /** `values` go one per category; a scatter gives `points` as [x, y] instead. */
  series: { name: string; values: (number | null)[]; points?: [number, number][] }[];
  /** Unit of the values (the y axis). */
  unit?: string;
  /** What the x axis measures, for a scatter. */
  xLabel?: string;
  stacked?: boolean;
  horizontal?: boolean;
  /** A band on the value axis (the green range), or a line when both ends are equal. */
  reference?: { from: number; to: number };
};

/** What every tool that changes something returns. */
export type WriteResult = { ok: true; summary: string } | { ok: false; error: string };

/** Tools that change mission data: each one waits for the operator's confirmation. */
export const WRITE_TOOLS = [
  'updateThresholds',
  'createMission',
  'updateMission',
  'startMission',
  'finishMission',
  'addCrewMember',
  'updateCrewMember',
  'removeCrewMember',
  'setMedicationPlan',
  'saveSampleResult',
  'setExercisePrescription',
  'editKpiDashboard',
] as const satisfies readonly (keyof WriteTools)[];
export type WriteTool = (typeof WRITE_TOOLS)[number];

/** Tools the browser runs itself: they change what this operator sees, not mission data. */
export const CLIENT_TOOLS = ['switchMission', 'openPage', 'setLanguage', 'setTheme'] as const;
export type ClientTool = (typeof CLIENT_TOOLS)[number];

export type AssistantTools = InferUITools<ReturnType<typeof createAssistantTools>['tools']>;
export type AssistantMessage = UIMessage<never, UIDataTypes, AssistantTools>;

/** Models the operator can pick in the composer; the first is the default. */
export const MODELS = [
  { id: 'gpt-5.5', name: 'GPT-5.5', hint: 'modelDefault' },
  { id: 'gpt-6-astra', name: 'GPT-6 Astra', hint: 'modelNext' },
  { id: 'gpt-5.4-mini', name: 'GPT-5.4 mini', hint: 'modelMini' },
] as const;
export type ModelId = (typeof MODELS)[number]['id'];

/** How much the model thinks and looks up before answering. */
export const EFFORTS = ['low', 'medium', 'high'] as const;
export type Effort = (typeof EFFORTS)[number];

export type Preferences = { model: ModelId; effort: Effort };
export const DEFAULT_PREFERENCES: Preferences = { model: 'gpt-5.5', effort: 'medium' };

export function checkPreferences(value: unknown): Preferences {
  const v = (typeof value === 'object' && value !== null ? value : {}) as Record<string, unknown>;
  return {
    model: MODELS.find((m) => m.id === v.model)?.id ?? DEFAULT_PREFERENCES.model,
    effort: EFFORTS.find((e) => e === v.effort) ?? DEFAULT_PREFERENCES.effort,
  };
}

export type CountermeasureTone = 'green' | 'amber' | 'red' | 'muted';

/** What the chat draws for a countermeasure area: one state per crew member and the tab. */
export type CountermeasureCardView = {
  area: string;
  title: string;
  page: string;
  rows: { id: string; name: string; tone: CountermeasureTone; label: string; detail?: string }[];
};
