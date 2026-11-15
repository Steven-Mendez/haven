import type { CrewPlan } from '@haven/core';
import { useEffect, useState } from 'react';
import { store } from '@/shared/data';
import { db } from '@/shared/db';

// The plan Earth assigned to this crew member, kept on the device so it also
// works offline. The medication feature downloads it; any screen can read it.

const plans = db.collection<CrewPlan>('crew_plan');
const CURRENT = 'current';
const listeners = new Set<(plan: CrewPlan | undefined) => void>();
let current: CrewPlan | undefined;

/** A stored plan only counts for the mission and crew member it was sent to. */
export function planFor(
  stored: CrewPlan | undefined,
  who: { mission: string; crewMember: string },
): CrewPlan | undefined {
  return stored && stored.mission === who.mission && stored.crewMember === who.crewMember
    ? stored
    : undefined;
}

export function currentCrew() {
  return { mission: store.mission().code, crewMember: store.preferences().crewMember };
}

export async function loadPlan(): Promise<CrewPlan | undefined> {
  current = planFor(await plans.get(CURRENT).catch(() => undefined), currentCrew());
  for (const listener of [...listeners]) listener(current);
  return current;
}

export async function savePlan(plan: CrewPlan): Promise<void> {
  await plans.put(CURRENT, plan);
  await loadPlan();
}

export function usePlan(): CrewPlan | undefined {
  const [plan, setPlan] = useState(current);
  useEffect(() => {
    listeners.add(setPlan);
    void loadPlan();
    return () => {
      listeners.delete(setPlan);
    };
  }, []);
  return plan;
}
