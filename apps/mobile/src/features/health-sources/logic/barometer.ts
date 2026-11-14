import type { Reading } from '@haven/core';

export const CABIN_PRESSURE = 'cabin-pressure';
export const PRESSURE_BUCKET_MS = 15 * 60_000;
export const PRESSURE_CHANGE_KPA = 0.5;

const MIN_KPA = 1;
const MAX_KPA = 200;

export function kPaFromHPa(hPa: number): number | undefined {
  if (!Number.isFinite(hPa)) return undefined;
  const kPa = Math.round(hPa) / 10;
  return kPa >= MIN_KPA && kPa <= MAX_KPA ? kPa : undefined;
}

export function isPressureChange(previous: number | undefined, next: number): boolean {
  return previous === undefined || Math.abs(next - previous) >= PRESSURE_CHANGE_KPA;
}

export function cabinPressureReading(input: {
  kPa: number;
  takenAt: Date;
  crewMember: string;
}): Reading {
  const bucket = Math.floor(input.takenAt.getTime() / PRESSURE_BUCKET_MS);
  return {
    id: `barometer:${CABIN_PRESSURE}:${input.crewMember}:${bucket}:${input.kPa}`,
    indicator: CABIN_PRESSURE,
    value: input.kPa,
    unit: 'kPa',
    takenAt: input.takenAt.toISOString(),
    source: 'phone',
    simulated: false,
    crewMember: input.crewMember,
  };
}
