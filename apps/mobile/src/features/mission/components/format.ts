import type { Environment } from '@haven/core';
import { delayParts } from '../logic/environment';

export function formatDelay(delayMin: number, language: string): string {
  const { value, unit, lessThan } = delayParts(delayMin);
  return `${lessThan ? '< ' : ''}${value.toLocaleString(language)} ${unit}`;
}

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
