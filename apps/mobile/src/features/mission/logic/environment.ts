// Environment helpers for M05: delay within the environment range and readable delay parts.
// Pure: only `@haven/core` types and relative modules.

import type { Destination, Environment } from '@haven/core';

type DelayRange = Pick<Environment, 'delayMin' | 'delayMax'>;

// Four decimals: the Moon is ~0.0213 min (1.28 s) away, which two decimals would push out of range.
const round4 = (value: number) => Math.round(value * 10_000) / 10_000;

/** Keeps `currentDelayMin` inside `[delayMin, delayMax]` of the environment (contract §7). */
export function clampDelay(environment: DelayRange, delayMin: number): number {
  const low = Math.min(environment.delayMin, environment.delayMax);
  const high = Math.max(environment.delayMin, environment.delayMax);
  if (!Number.isFinite(delayMin)) return defaultDelay(environment);
  return round4(Math.min(high, Math.max(low, delayMin)));
}

/**
 * Delay used when switching to an environment without a destination: its first destination's delay
 * if any (Mars → 11 min), otherwise the middle of the range. Always within the range.
 */
export function defaultDelay(environment: DelayRange & Pick<Environment, 'destinations'>): number {
  const first = environment.destinations?.[0];
  if (first) return clampDelay(environment, first.delayMin);
  const middle = (environment.delayMin + environment.delayMax) / 2;
  return middle >= 1 ? Math.round(middle) : round4(middle);
}

/**
 * Delay when switching environment: keeps the current delay if it still fits the new range
 * (so moving between Mars and transit keeps 11 min), otherwise the environment default.
 */
export function delayForEnvironment(environment: Environment, currentDelayMin?: number): number {
  if (
    currentDelayMin !== undefined &&
    currentDelayMin >= Math.min(environment.delayMin, environment.delayMax) &&
    currentDelayMin <= Math.max(environment.delayMin, environment.delayMax)
  ) {
    return round4(currentDelayMin);
  }
  return defaultDelay(environment);
}

/** Delay of a destination, clamped to its environment. */
export function delayForDestination(environment: Environment, destination: Destination): number {
  return clampDelay(environment, destination.delayMin);
}

/** Whether the environment allows choosing the delay (range wider than a second). */
export function hasDelayRange(environment: DelayRange): boolean {
  return Math.abs(environment.delayMax - environment.delayMin) >= 1;
}

/** Readable delay: ≥ 1 min in minutes (one decimal), below in seconds (≥ 1 s), 0 → «< 1 s». */
export function delayParts(delayMin: number): {
  value: number;
  unit: 'min' | 's';
  lessThan?: boolean;
} {
  if (delayMin >= 1) return { value: Math.round(delayMin * 10) / 10, unit: 'min' };
  const seconds = Math.round(delayMin * 60);
  if (seconds < 1) return { value: 1, unit: 's', lessThan: true };
  return { value: seconds, unit: 's' };
}
