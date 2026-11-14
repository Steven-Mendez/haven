import { loadConfig, type MissionPhase, missionTemplates } from '@haven/core';
import { type Language, translate } from '@/lib/i18n';

export type EnvironmentOption = {
  id: string;
  name: string;
  description: string;
  watch: string[];
  gravity: number;
  dailyDoseMSv: number;
  delayMin: number;
  delayMax: number;
  evacuation: boolean;
};

export type TemplateOption = {
  id: string;
  name: string;
  description: string;
  summary: string;
  basedOn: string;
  sourceUrl?: string;
  phases: MissionPhase[];
};

export const SCRATCH_PHASES: MissionPhase[] = [
  { environment: 'launch', days: 1 },
  { environment: 'reentry', days: 1 },
];

export function templatePhases(id: string): MissionPhase[] {
  return missionTemplates.find((m) => m.id === id)?.phases ?? SCRATCH_PHASES;
}

export function planOptions(lang: Language) {
  const config = loadConfig();
  const environments: EnvironmentOption[] = config.environments.map((e) => ({
    id: e.id,
    name: translate(e.name, lang),
    description: e.description ? translate(e.description, lang) : '',
    watch: (e.watch ?? []).map((w) => translate(w, lang)),
    gravity: e.gravity,
    dailyDoseMSv: e.dailyDoseMSv ?? 0,
    delayMin: e.delayMin,
    delayMax: e.delayMax,
    evacuation: e.evacuation,
  }));
  const templates: TemplateOption[] = missionTemplates.map((m) => ({
    id: m.id,
    name: translate(m.name, lang),
    description: translate(m.description, lang),
    summary: translate(m.summary, lang),
    basedOn: translate(m.basedOn, lang),
    sourceUrl: m.sourceUrl,
    phases: m.phases,
  }));
  return { environments, templates };
}
