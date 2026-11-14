import { type Assessment, activeSymptoms, type Config, evaluate, type Reading } from '@haven/core';

export type PreviewInput = {
  config: Config;
  environment: string;
  readings: Reading[];
  candidates: Reading[];
  baselines: Record<string, Assessment['baseline'] | undefined>;
  symptoms: Reading[];
  now: Date;
};

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

export function baselineDelta(
  value: number | undefined,
  baseline: Assessment['baseline'] | undefined,
): number | undefined {
  if (value === undefined || !baseline) return undefined;
  return value - baseline.median;
}
