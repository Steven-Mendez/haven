// Presentation types. Data shapes come from the Earth API types (`@/server/types`, owned by the backend),
// so components take exactly what the views get from `features/<x>/server.ts`.
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

/** Visual status: the four engine levels plus "no recent data" (Earth only). */
export type VisualLevel = Level | 'no-data';

/** Reference instant for ages. The view passes it in (see DISENO.md § Tiempo). */
export type Now = string | number | Date;

/** A series point as the API returns it: [epoch ms (or ISO), value]. */
export type SeriesPoint = [number | string, number];
