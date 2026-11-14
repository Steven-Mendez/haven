// Quick manual entry of vital signs during an emergency (M06). Pure: imports only @haven/core.

import type { Reading } from '@haven/core';

/** Vital signs the "measure-vitals" step asks for, in screen order. */
export const VITAL_IDS = ['systolic-bp', 'diastolic-bp', 'spo2', 'heart-rate'] as const;
export type VitalId = (typeof VITAL_IDS)[number];

/** Plausible ranges to reject typos (not clinical thresholds: those live in the config). */
export const VITAL_LIMITS: Record<VitalId, [number, number]> = {
  'systolic-bp': [40, 300],
  'diastolic-bp': [20, 200],
  spo2: [50, 100],
  'heart-rate': [20, 250],
};

/** Parses a typed value ("118", "94,5"); undefined when empty, not a number or implausible. */
export function parseVital(id: VitalId, text: string): number | undefined {
  const trimmed = text.trim().replace(',', '.');
  if (trimmed === '') return undefined;
  const value = Number(trimmed);
  const [min, max] = VITAL_LIMITS[id];
  return Number.isFinite(value) && value >= min && value <= max ? value : undefined;
}

/** True when the text is filled in but not acceptable (to flag the field). */
export function isInvalidVital(id: VitalId, text: string): boolean {
  return text.trim() !== '' && parseVital(id, text) === undefined;
}

/**
 * Manual readings (`source: 'manual'`) for every valid typed value. `units` comes from the config
 * (`Indicator.unit`); `newId` gives each reading its id.
 */
export function manualVitalReadings(
  values: Partial<Record<VitalId, string>>,
  units: Record<string, string>,
  crewMember: string,
  now: Date,
  newId: () => string,
): Reading[] {
  const readings: Reading[] = [];
  for (const id of VITAL_IDS) {
    const value = parseVital(id, values[id] ?? '');
    if (value === undefined) continue;
    readings.push({
      id: newId(),
      indicator: id,
      value,
      unit: units[id] ?? '',
      takenAt: now.toISOString(),
      source: 'manual',
      simulated: false,
      crewMember,
      note: 'emergency',
    });
  }
  return readings;
}
