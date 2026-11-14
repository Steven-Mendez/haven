// T01 backend · Response types of the Earth API (contract D in EQUIPOS.md, names in GLOSSARY.md).
//
// This file does NOT import 'server-only': views (client or server components) can import these types and
// constants without pulling in MongoDB:
//
//   import type { CrewResponse } from '@/server/types';
//
// The server functions that return these shapes live in features/<x>/server.ts.

import type { Assessment, I18n, Level, Mission, MissionPhase, Packet } from '@haven/core';

/** A crew member with no visible packet created in the last 6 h is shown as "no recent data". */
export const NO_RECENT_DATA_HOURS = 6;
export const NO_RECENT_DATA_MS = NO_RECENT_DATA_HOURS * 60 * 60 * 1000;

/** Mission code used when `?mission=` is missing (Ares-1). */
export const DEFAULT_MISSION = 'ARES01';

export type ApiError = { error: string; details?: string[] };

/** `POST /api/packets` → 201 (new) or 200 with `duplicate: true` (same `id` already received). */
export type PacketReceipt = {
  id: string;
  receivedAt: string;
  visibleAt: string;
  duplicate?: boolean;
};

/** A packet as the API returns it: the phone's original with `visibleAt` = server receive time. */
export type ReceivedPacket = Packet & {
  /** Server time when the packet arrived. */
  receivedAt: string;
  /** Time of the data: newest reading `takenAt` (or `createdAt` without readings), capped at `receivedAt`. */
  dataAt: string;
};

export type ZoneLevel = { zone: string; level: Level };
export type ZoneProgress = { zone: string; progress: number };

/**
 * Where a mission is in its life. Preparation: `planned` (waiting for «Start mission») or `scheduled` (starts on
 * a future date); everything can still change. `active`: days are running; the plan is fixed. `finished`: it
 * reached its end (or was finished by hand) and stays as a record. Only `active` and `finished` have a day ≥ 1.
 */
export type MissionStatus = 'planned' | 'scheduled' | 'active' | 'finished';

export type MissionHeader = {
  code: string;
  name: string;
  environment: string;
  /** Mission day; 0 until the mission starts. */
  day: number;
  status: MissionStatus;
  /** Day 1 (planned date while `planned`). */
  start: string;
  delayMin: number;
  linkDown: boolean;
  /** Time of the most recent data of the whole crew; `null` if none. */
  lastDataAt: string | null;
  /** Current phase when the mission has a phase plan (`environment` is that phase's). */
  phase?: CurrentPhase;
};

/** Where a phased mission is today: 0-based `index` of `total`, its days and optional name. */
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
  /** Crew role, stored with the mission crew (`missions.crew[].role`); absent when not set. */
  role?: I18n;
  /** Time of the latest data (`dataAt` of the newest packet); `null` if none. Age = now − lastDataAt. */
  lastDataAt: string | null;
  /** When that packet was received on Earth (= its `visibleAt`). */
  lastVisibleAt: string | null;
  /** `true` when the latest data is older than NO_RECENT_DATA_HOURS (or there is none). Never "normal". */
  noRecentData: boolean;
  /** Latest received `dailyProgress`; `null` if it never arrived. */
  dailyProgress: ZoneProgress[] | null;
  dailyProgressAt: string | null;
  /** Zones with progress 1 in the latest `dailyProgress` ("n of actionsTotal"). */
  actionsDone: number;
  actionsTotal: number;
  /** Worst level per zone from the latest packet's `assessments` (evaluateZones). No data: pending. */
  zones: ZoneLevel[];
  /** Amber and red assessments of the latest packet, red first. */
  alerts: Assessment[];
  lastPacket: { id: string; type: Packet['type']; visibleAt: string } | null;
};

export type MissionSummary = {
  actionsDone: number;
  actionsTotal: number;
  amberZones: number;
  redZones: number;
  delayMin: number;
};

/** `GET /api/crew?mission=CODE` */
export type CrewResponse = {
  generatedAt: string;
  mission: MissionHeader;
  summary: MissionSummary;
  crew: CrewCard[];
};

/** `GET /api/astronaut/[id]?mission=CODE` */
export type AstronautResponse = {
  generatedAt: string;
  mission: MissionHeader;
  crewMember: CrewCard;
  /** Assessments of the latest packet (with the engine's `explanation`, as the astronaut saw it). */
  assessments: Assessment[];
  /** `[t (ms since epoch), value]` per indicator from numeric readings, ascending. */
  series: Record<string, [number, number][]>;
  /** Received packets, newest first, as sent: notes, reading/photo notes and diary included. */
  packets: ReceivedPacket[];
};

export type StoredMission = Mission & {
  /** Crew entries may carry a display `role` (stored data, e.g. written by the seed). */
  crew: (Mission['crew'][number] & { role?: I18n })[];
  name: string;
  /** Mission day 1; `day` is computed from here. */
  start: string;
  durationDays: number;
  createdAt: string;
  origin: 'earth' | 'packet' | 'seed';
  /** Created on Earth but not started: days do not run until «Start mission». Absent = started. */
  awaitingStart?: boolean;
  /** Set by «Finish mission» (or the end of the plan): from then on it is a record. */
  finishedAt?: string;
  /** Computed by the API from `awaitingStart` and `start` (never stored). */
  status?: MissionStatus;
  /** Phase plan (launch → … → reentry). When present, `environment`, `currentDelayMin` and
   * `durationDays` are derived from it for the current day; older missions have a single environment. */
  phases?: MissionPhase[];
};

/** `GET /api/missions` */
export type MissionsResponse = { missions: StoredMission[] };

/** `POST /api/missions` (body). `code` is generated when missing. */
export type NewMission = {
  name: string;
  /** Single-environment mission; not needed with `phases` (the first phase's is used). */
  environment?: string;
  /** Phase plan; sets `environment` and `durationDays`. */
  phases?: MissionPhase[];
  start?: string;
  durationDays?: number;
  currentDelayMin?: number;
  crew?: Mission['crew'];
  /** Created but not started: days run from «Start mission» on Earth. */
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
  /** Full or partial config (whatever T03 produces). */
  config: Record<string, unknown>;
  /** Created on Earth. */
  sentAt: string;
  /** First download by a phone (GET /api/rules); `null` until then. */
  receivedAt: string | null;
  /** Every download: who (`?crewMember=` or `X-Haven-Actor`, default "phone") and when. */
  receivedBy: { crewMember: string; at: string }[];
  appliedAt: string | null;
  appliedBy: { crewMember: string; at: string }[];
  /** sent: created on Earth · received: a phone downloaded it · applied: a phone confirmed it applied it. */
  status: DeliveryStatus;
};

/** `GET /api/rules?mission=CODE[&crewMember=ID]` (an HTTP GET is a phone download and marks versions received). */
export type RulesResponse = { mission: string; versions: RulesVersion[] };

/** `POST /api/rules?mission=CODE` (body) to create a version. */
export type NewRulesVersion = {
  config: Record<string, unknown>;
  version?: string;
  note?: string;
  author?: string;
};

/** `POST /api/rules?mission=CODE` (body) for the phone to mark a version as applied. */
export type ApplyRulesVersion = { apply: string; crewMember?: string; appliedAt?: string };

/** Crew aggregates (T03): `null` per indicator only when nobody measured it. */
export type AggregatesResponse = {
  mission: string;
  indicators: Record<string, { date: string; mean: number }[] | null>;
};
