// What to show instead of «Day n» for Earth's mission states. Pure: imports only @haven/core types.
//   planned            → being prepared (days do not run, no date yet)
//   scheduled          → starts on a date (days do not run yet)
//   active (or absent) → day n
//   finished           → a record: its last day and «Finished»

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

/** Days run (and «Day n» makes sense) only while the mission is running or once it finished. */
export function hasDay(phase: MissionPhase): phase is Extract<MissionPhase, { day: number }> {
  return phase.kind === 'running' || phase.kind === 'finished';
}

export type PhaseTexts = { day: string; preparing: string; startsOn: string; finishedDay: string };

/** One short line for the phase: «Day 12», «Being prepared», «Starts on 3 Dec», «Finished · day 540». */
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
