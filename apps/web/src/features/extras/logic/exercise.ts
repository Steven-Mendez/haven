import {
  assessmentDue,
  assessmentSuggestion,
  type CrewPlan,
  dayMinutes,
  type ExerciseAssessment,
  type ExerciseCompliance,
  type ExerciseDay,
  type ExerciseMinutes,
  type ExercisePrescription,
  type ExerciseSuggestion,
  exercise,
  exerciseCompliance,
  exerciseWeek,
  firstDataAt,
  latestAssessment,
  prescriptionOf,
  type Reading,
} from '@haven/core';

export type ExerciseRow = {
  id: string;
  name: string;
  lastDataAt: string | null;
  noRecentData: boolean;
  prescription: ExercisePrescription;
  /** Earth changed it; otherwise the config default applies. */
  custom: boolean;
  today: ExerciseMinutes;
  week: ExerciseDay[];
  compliance: ExerciseCompliance;
  assessment?: ExerciseAssessment;
  suggestion?: ExerciseSuggestion;
  assessmentDue: boolean;
};

export function exerciseRow(
  member: { id: string; name: string; lastDataAt: string | null; noRecentData: boolean },
  plan: Pick<CrewPlan, 'exercise'>,
  readings: Reading[],
  now: Date,
): ExerciseRow {
  const p = prescriptionOf(plan, exercise);
  // Without any reading the crew member has not used the app yet: nothing to measure.
  const since = firstDataAt(readings) ?? now.toISOString();
  const week = exerciseWeek(readings, p, now, since);
  const assessment = latestAssessment(readings);
  return {
    ...member,
    prescription: p,
    custom: Boolean(plan.exercise),
    today: dayMinutes(readings, now.toISOString().slice(0, 10)),
    week,
    compliance: exerciseCompliance(week, p),
    ...(assessment ? { assessment, suggestion: assessmentSuggestion(assessment, exercise) } : {}),
    assessmentDue: assessmentDue(assessment, exercise, now, since),
  };
}

/** Whole minutes or days from a form field, or NaN so the prescription check rejects it. */
export function formInt(value: FormDataEntryValue | null): number {
  const text = String(value ?? '').trim();
  return /^\d{1,3}$/.test(text) ? Number(text) : Number.NaN;
}
