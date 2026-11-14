import type { Assessment } from './assessment';
import type { Reading } from './reading';

export type EmergencyStatus = 'open' | 'unresponsive' | 'closed';

export type EmergencyInfo = {
  id: string;
  status: EmergencyStatus;
  startedAt: string;
  origin?: string;
  forOther?: boolean;
};

export type Packet = {
  id: string;
  type: 'routine' | 'emergency';
  crewMember: string;
  assessments: Assessment[];
  readings: Reading[];
  notes: string;
  photos?: { uri: string; takenAt: string; note?: string }[];
  ecg?: { hz: number; microvolts: number[] };
  dailyProgress?: { zone: string; progress: number }[];
  emergency?: EmergencyInfo;
  mission: string;
  createdAt: string;
  sentAt: string;
  visibleAt: string;
};

export type MissionStatus = 'planned' | 'scheduled' | 'active' | 'finished';

export type Mission = {
  code: string;
  name?: string;
  status?: MissionStatus;
  start?: string;
  environment: string;
  day: number;
  currentDelayMin: number;
  linkDown: boolean;
  scenario?: string;
  crew: { id: string; name: string; hasWatch: boolean }[];
};
