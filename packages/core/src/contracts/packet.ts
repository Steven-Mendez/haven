// Shared contracts §6 and §7 · Packet to Earth and mission state.

import type { Assessment } from './assessment';
import type { Reading } from './reading';

export type Packet = {
  id: string;
  type: 'routine' | 'emergency';
  crewMember: string; // Earth groups by crew member
  assessments: Assessment[];
  readings: Reading[];
  notes: string;
  photos?: { uri: string; takenAt: string; note?: string }[]; // phone camera; the API stores them with the packet
  ecg?: { hz: number; microvolts: number[] }; // voltages; a Blob does not travel in JSON
  dailyProgress?: { zone: string; progress: number }[]; // daily action per zone (M03)
  mission: string; // Mission.code; Earth groups by mission and crew member
  createdAt: string;
  sentAt: string;
  visibleAt: string; // sentAt + Mission.currentDelayMin; the API recomputes it from its receive time
};

/** Earth's mission states: planned and scheduled are «in preparation» (days do not run yet). */
export type MissionStatus = 'planned' | 'scheduled' | 'active' | 'finished';

export type Mission = {
  code: string; // six characters; identifies the mission to the Earth API, no accounts (M05, T01)
  name?: string; // display name from Earth or the creator; the code is not shown as a title
  status?: MissionStatus; // absent = active (missions from before states existed)
  start?: string; // day 1, YYYY-MM-DD (planned date while in preparation)
  environment: string;
  day: number; // 0 while in preparation; a finished mission stays on its last day
  currentDelayMin: number; // within [delayMin, delayMax] of the environment
  linkDown: boolean;
  scenario?: string;
  crew: { id: string; name: string; hasWatch: boolean }[];
};
