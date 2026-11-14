import type { Reading } from '@haven/core';

export const VITAL_IDS = ['systolic-bp', 'diastolic-bp', 'spo2', 'heart-rate'] as const;
export type VitalId = (typeof VITAL_IDS)[number];

export const VITAL_LIMITS: Record<VitalId, [number, number]> = {
  'systolic-bp': [40, 300],
  'diastolic-bp': [20, 200],
  spo2: [50, 100],
  'heart-rate': [20, 250],
};

export function parseVital(id: VitalId, text: string): number | undefined {
  const trimmed = text.trim().replace(',', '.');
  if (trimmed === '') return undefined;
  const value = Number(trimmed);
  const [min, max] = VITAL_LIMITS[id];
  return Number.isFinite(value) && value >= min && value <= max ? value : undefined;
}

export function isInvalidVital(id: VitalId, text: string): boolean {
  return text.trim() !== '' && parseVital(id, text) === undefined;
}

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
