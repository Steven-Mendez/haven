import { type Assessment, activeSymptoms, type Config, evaluate, type Reading } from '@haven/core';

// Live badge while typing (DESIGN_SYSTEM 4.1a, like Fitbit): the level the engine would give
// if the candidate readings were saved now. Uses the real engine, so it never disagrees with
// what the screen shows after saving.

export type PreviewInput = {
  config: Config;
  environment: string;
  /** Existing readings of the indicators being entered (any order). */
  readings: Reading[];
  /** Candidate readings not saved yet. */
  candidates: Reading[];
  baselines: Record<string, Assessment['baseline'] | undefined>;
  /** Symptom readings (`indicator: 'symptom'`); only the last 6 h count. */
  symptoms: Reading[];
  now: Date;
};

/** Assessments of the candidate indicators, in candidate order. */
export function previewAssessments(input: PreviewInput): Assessment[] {
  const ids = input.candidates.map((c) => c.indicator);
  const all = [...input.readings, ...input.candidates].sort((a, b) =>
    a.takenAt.localeCompare(b.takenAt),
  );
  const baselines = Object.fromEntries(
    Object.entries(input.baselines).filter(
      (entry): entry is [string, NonNullable<Assessment['baseline']>] => Boolean(entry[1]),
    ),
  );
  const assessments = evaluate(
    all,
    input.config,
    input.environment,
    baselines,
    activeSymptoms(input.symptoms, input.now),
    input.now,
  );
  return ids
    .map((id) => assessments.find((a) => a.indicator === id))
    .filter((a): a is Assessment => Boolean(a));
}

/** Signed difference to the baseline median, `undefined` without a baseline. */
export function baselineDelta(
  value: number | undefined,
  baseline: Assessment['baseline'] | undefined,
): number | undefined {
  if (value === undefined || !baseline) return undefined;
  return value - baseline.median;
}
