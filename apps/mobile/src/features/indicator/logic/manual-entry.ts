import type { Config, Indicator, Reading } from '@haven/core';

// Manual entry «Register» (M02): which indicators one form records, parsing, validation, the
// out-of-reference mark and the `Reading` itself (`source: 'manual'`, never simulated).

/** Indicators recorded together in one form (one reading each). Blood pressure: two readings. */
export const PAIRED_INDICATORS: readonly (readonly string[])[] = [['systolic-bp', 'diastolic-bp']];

/** Indicator ids the form for `indicatorId` records, in form order. */
export function entryIndicators(indicatorId: string): string[] {
  const pair = PAIRED_INDICATORS.find((p) => p.includes(indicatorId));
  return pair ? [...pair] : [indicatorId];
}

/** Parses what the user typed: accepts a decimal comma («36,8»). `undefined` if not a number. */
export function parseNumber(text: string): number | undefined {
  const clean = text.trim().replace(/\s+/g, '').replace(',', '.');
  if (clean === '' || !/^[-+]?\d*\.?\d+$/.test(clean)) return undefined;
  const n = Number(clean);
  return Number.isFinite(n) ? n : undefined;
}

export type EntryError = 'empty' | 'notNumber';

/** Validates one numeric field. Plausibility is not judged here: the engine evaluates the value. */
export function validateNumber(text: string): EntryError | undefined {
  if (text.trim() === '') return 'empty';
  return parseNumber(text) === undefined ? 'notNumber' : undefined;
}

/** `true` when a numeric value falls outside the reference range (`Indicator.green`). */
export function isOutsideReference(indicator: Indicator, value: number): boolean {
  if (indicator.kind !== 'number') return false;
  const [low, high] = indicator.green;
  return value < low || value > high;
}

/** Whether `value` is below or above the reference range, for the inline mark. */
export function referenceSide(indicator: Indicator, value: number): 'below' | 'above' | 'inside' {
  if (indicator.kind !== 'number') return 'inside';
  if (value < indicator.green[0]) return 'below';
  if (value > indicator.green[1]) return 'above';
  return 'inside';
}

/** Zone whose daily action is recording this indicator (or its pair), if any. */
export function dailyActionZone(config: Config, indicatorId: string): string | undefined {
  const ids = entryIndicators(indicatorId);
  return config.zones.find((z) => ids.includes(z.dailyAction.opens))?.id;
}

export function manualReading(input: {
  id: string;
  indicator: Indicator;
  value: number | string;
  crewMember: string;
  takenAt: string;
}): Reading {
  return {
    id: input.id,
    indicator: input.indicator.id,
    value: input.value,
    unit: input.indicator.unit,
    takenAt: input.takenAt,
    source: 'manual',
    simulated: false,
    crewMember: input.crewMember,
  };
}
