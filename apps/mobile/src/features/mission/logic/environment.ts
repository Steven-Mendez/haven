import type { Destination, Environment } from '@haven/core';

type DelayRange = Pick<Environment, 'delayMin' | 'delayMax'>;

const round4 = (value: number) => Math.round(value * 10_000) / 10_000;

export function clampDelay(environment: DelayRange, delayMin: number): number {
  const low = Math.min(environment.delayMin, environment.delayMax);
  const high = Math.max(environment.delayMin, environment.delayMax);
  if (!Number.isFinite(delayMin)) return defaultDelay(environment);
  return round4(Math.min(high, Math.max(low, delayMin)));
}

export function defaultDelay(environment: DelayRange & Pick<Environment, 'destinations'>): number {
  const first = environment.destinations?.[0];
  if (first) return clampDelay(environment, first.delayMin);
  const middle = (environment.delayMin + environment.delayMax) / 2;
  return middle >= 1 ? Math.round(middle) : round4(middle);
}

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

export function delayForDestination(environment: Environment, destination: Destination): number {
  return clampDelay(environment, destination.delayMin);
}

export function hasDelayRange(environment: DelayRange): boolean {
  return Math.abs(environment.delayMax - environment.delayMin) >= 1;
}

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
