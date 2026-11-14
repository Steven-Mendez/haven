import type { Mission } from '@haven/core';

export type MissionPhase =
  | { kind: 'preparing' }
  | { kind: 'scheduled'; start: string }
  | { kind: 'running'; day: number }
  | { kind: 'finished'; day: number };

export function missionPhase(mission: Pick<Mission, 'status' | 'day' | 'start'>): MissionPhase {
  switch (mission.status) {
    case 'planned':
      return { kind: 'preparing' };
    case 'scheduled':
      return mission.start ? { kind: 'scheduled', start: mission.start } : { kind: 'preparing' };
    case 'finished':
      return { kind: 'finished', day: Math.max(1, mission.day) };
    default:
      return { kind: 'running', day: Math.max(1, mission.day) };
  }
}

export function hasDay(phase: MissionPhase): phase is Extract<MissionPhase, { day: number }> {
  return phase.kind === 'running' || phase.kind === 'finished';
}

export type PhaseTexts = { day: string; preparing: string; startsOn: string; finishedDay: string };

export function missionPhaseText(
  phase: MissionPhase,
  texts: PhaseTexts,
  formatDate: (isoDate: string) => string,
): string {
  switch (phase.kind) {
    case 'preparing':
      return texts.preparing;
    case 'scheduled':
      return texts.startsOn.replace('{date}', formatDate(phase.start));
    case 'finished':
      return texts.finishedDay.replace('{n}', String(phase.day));
    default:
      return texts.day.replace('{n}', String(phase.day));
  }
}
