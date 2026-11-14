import type { Environment } from '@haven/core';
import { delayParts } from '../logic/environment';

/** «11 min», «1 s», «< 1 s». Decimal separator of the language. */
export function formatDelay(delayMin: number, language: string): string {
  const { value, unit, lessThan } = delayParts(delayMin);
  return `${lessThan ? '< ' : ''}${value.toLocaleString(language)} ${unit}`;
}

/** «3–22 min» or a single value when the range is fixed. */
export function formatDelayRange(environment: Environment, language: string): string {
  const low = formatDelay(environment.delayMin, language);
  const high = formatDelay(environment.delayMax, language);
  if (low === high) return low;
  const [lowValue, lowUnit] = low.split(' ');
  const highUnit = high.split(' ').at(-1);
  return lowUnit === highUnit && !low.startsWith('<') ? `${lowValue}–${high}` : `${low} – ${high}`;
}

export function formatNumber(value: number, language: string, digits = 2): string {
  return value.toLocaleString(language, { maximumFractionDigits: digits });
}
