import type { Level } from '@haven/core';

export type {
  AstronautResponse,
  CrewCard,
  CrewResponse,
  MissionHeader as MissionInfo,
  MissionSummary as MissionTotals,
  ReceivedPacket,
  ZoneLevel,
  ZoneProgress,
} from '@/server/types';

export type VisualLevel = Level | 'no-data';

export type Now = string | number | Date;

export type SeriesPoint = [number | string, number];
