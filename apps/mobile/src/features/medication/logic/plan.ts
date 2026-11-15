import { type CrewPlan, cleanAssignments, type MedicationConfig } from '@haven/core';

/**
 * Reads the /api/plan response. Only a plan for the same mission and crew
 * member is accepted; its assignments are cleaned against the local catalog.
 */
export function parsePlanResponse(
  body: unknown,
  expected: { mission: string; crewMember: string },
  cfg: MedicationConfig,
): CrewPlan | undefined {
  if (!body || typeof body !== 'object') return undefined;
  const b = body as Record<string, unknown>;
  if (b.mission !== expected.mission || b.crewMember !== expected.crewMember) return undefined;
  if (typeof b.updatedAt !== 'string' || Number.isNaN(Date.parse(b.updatedAt))) return undefined;
  return {
    mission: expected.mission,
    crewMember: expected.crewMember,
    medications: cleanAssignments(b.medications, cfg),
    updatedAt: b.updatedAt,
    ...(typeof b.author === 'string' ? { author: b.author.slice(0, 80) } : {}),
  };
}
