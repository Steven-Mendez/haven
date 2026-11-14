import type { NextAction } from './next-action';

export type FirstRunStep = { id: 'measure'; next: NextAction } | { id: 'sources' } | { id: 'who' };

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
