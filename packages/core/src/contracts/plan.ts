import type { MedicationSchedule } from './config';

export type MedicationAssignment = {
  medication: string;
  /** Replaces the catalog schedule when Earth sets a different one. */
  schedule?: MedicationSchedule;
  /** Last day of the treatment (YYYY-MM-DD, mission time); open-ended without it. */
  until?: string;
  note?: string;
};

/** What Earth assigns to one crew member; the app downloads it from /api/plan. */
export type CrewPlan = {
  mission: string;
  crewMember: string;
  medications: MedicationAssignment[];
  updatedAt: string;
  author?: string;
};
