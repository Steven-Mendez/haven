import type { NextAction } from './next-action';

// «Getting started» card (M01) while there are no readings yet: ways in, not a checklist, so a
// step never shows as done before the data actually arrives.

export type FirstRunStep = { id: 'measure'; next: NextAction } | { id: 'sources' } | { id: 'who' };

/**
 * Steps to show, in order: record a first value (the next daily action), connect automatic
 * sources, and pick who uses this phone when the crew member is not on the mission roster.
 * Empty once any reading exists.
 */
export function firstRunSteps({
  readings,
  next,
  crew,
  crewMember,
}: {
  readings: number;
  next: NextAction | undefined;
  crew: { id: string }[];
  crewMember: string;
}): FirstRunStep[] {
  if (readings > 0) return [];
  const steps: FirstRunStep[] = [];
  if (next) steps.push({ id: 'measure', next });
  steps.push({ id: 'sources' });
  if (crew.length > 0 && !crew.some((c) => c.id === crewMember)) steps.push({ id: 'who' });
  return steps;
}
