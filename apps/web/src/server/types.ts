import type { Assessment, I18n, Level, Mission, MissionPhase, Packet } from '@haven/core';

export const NO_RECENT_DATA_HOURS = 6;
export const NO_RECENT_DATA_MS = NO_RECENT_DATA_HOURS * 60 * 60 * 1000;

export const DEFAULT_MISSION = 'ARES01';

export type ApiError = { error: string; details?: string[] };

export type PacketReceipt = {
  id: string;
  receivedAt: string;
  visibleAt: string;
  duplicate?: boolean;
};

export type ReceivedPacket = Packet & {
  receivedAt: string;
  dataAt: string;
};

export type ZoneLevel = { zone: string; level: Level };
export type ZoneProgress = { zone: string; progress: number };

export const CREW_NOT_READY = 'Crew not ready';

export type MissionStatus = 'planned' | 'scheduled' | 'active' | 'finished';

export type MissionHeader = {
  code: string;
  name: string;
  environment: string;
  day: number;
  status: MissionStatus;
  start: string;
  delayMin: number;
  linkDown: boolean;
  lastDataAt: string | null;
  phase?: CurrentPhase;
};

export type CurrentPhase = {
  index: number;
  total: number;
  startDay: number;
  endDay: number;
  label?: I18n;
};

export type CrewCard = {
  id: string;
  name: string;
  hasWatch: boolean;
  role?: I18n;
  joinedAt: string | null;
  lastDataAt: string | null;
  lastVisibleAt: string | null;
  noRecentData: boolean;
  dailyProgress: ZoneProgress[] | null;
  dailyProgressAt: string | null;
  actionsDone: number;
  actionsTotal: number;
  zones: ZoneLevel[];
  alerts: Assessment[];
  lastPacket: { id: string; type: Packet['type']; visibleAt: string } | null;
  emergency: OpenEmergency | null;
};

export type OpenEmergency = {
  id: string;
  visibleAt: string;
  status: 'open' | 'unresponsive';
  forOther?: boolean;
};

export type MissionSummary = {
  actionsDone: number;
  actionsTotal: number;
  amberZones: number;
  redZones: number;
  delayMin: number;
};

export type CrewResponse = {
  generatedAt: string;
  mission: MissionHeader;
  summary: MissionSummary;
  crew: CrewCard[];
};

export type AstronautResponse = {
  generatedAt: string;
  mission: MissionHeader;
  crewMember: CrewCard;
  assessments: Assessment[];
  series: Record<string, [number, number][]>;
  packets: ReceivedPacket[];
};

export type StoredMission = Omit<Mission, 'crew'> & {
  crew: (Mission['crew'][number] & { role?: I18n; joinedAt?: string })[];
  name: string;
  start: string;
  durationDays: number;
  createdAt: string;
  origin: 'earth' | 'packet' | 'seed';
  awaitingStart?: boolean;
  finishedAt?: string;
  status?: MissionStatus;
  phases?: MissionPhase[];
};

export type MissionsResponse = { missions: StoredMission[] };

export type NewMission = {
  name: string;
  environment?: string;
  phases?: MissionPhase[];
  start?: string;
  durationDays?: number;
  currentDelayMin?: number;
  crew?: Mission['crew'];
  awaitingStart?: boolean;
  code?: string;
};

export type DeliveryStatus = 'sent' | 'received' | 'applied';

export type RulesVersion = {
  id: string;
  mission: string;
  version: string;
  note: string;
  author: string;
  config: Record<string, unknown>;
  sentAt: string;
  receivedAt: string | null;
  receivedBy: { crewMember: string; at: string }[];
  appliedAt: string | null;
  appliedBy: { crewMember: string; at: string }[];
  status: DeliveryStatus;
};

export type RulesResponse = { mission: string; versions: RulesVersion[] };

export type NewRulesVersion = {
  config: Record<string, unknown>;
  version?: string;
  note?: string;
  author?: string;
};

export type ApplyRulesVersion = { apply: string; crewMember?: string; appliedAt?: string };

export type AggregatesResponse = {
  mission: string;
  indicators: Record<string, { date: string; mean: number }[] | null>;
};
