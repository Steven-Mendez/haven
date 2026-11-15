import {
  type Assessment,
  BATTERY_INDICATORS,
  type Config,
  type EvaPrepStatus,
  eva,
  evaPrepStatus,
  type Level,
  type Reading,
  worstLevel,
} from '@haven/core';

export type EvaCategory = 'vitals' | 'cognition' | 'sleep' | 'environment';
export const EVA_CATEGORIES: EvaCategory[] = ['vitals', 'cognition', 'sleep', 'environment'];

export type EvaReadiness = 'fit' | 'review' | 'unfit' | 'no-data';

export type EvaRow = {
  id: string;
  name: string;
  lastDataAt: string | null;
  noRecentData: boolean;
  categories: Record<EvaCategory, Level>;
  readiness: EvaReadiness;
  reasons: EvaCategory[];
  prep: EvaPrepStatus;
};

export function categoryIndicators(config: Config): Record<EvaCategory, string[]> {
  const zone = (id: string) => config.zones.find((z) => z.id === id)?.indicators ?? [];
  return {
    vitals: zone('vitals'),
    cognition: [...BATTERY_INDICATORS],
    sleep: ['sleep'],
    environment: zone('environment'),
  };
}

export function evaRow(
  member: { id: string; name: string; lastDataAt: string | null; noRecentData: boolean },
  assessments: Assessment[],
  config: Config,
  readings: Reading[] = [],
  now: Date = new Date(),
): EvaRow {
  const ids = categoryIndicators(config);
  const categories = Object.fromEntries(
    EVA_CATEGORIES.map((c) => [
      c,
      worstLevel(assessments.filter((a) => ids[c].includes(a.indicator)).map((a) => a.level)),
    ]),
  ) as Record<EvaCategory, Level>;
  const levels = EVA_CATEGORIES.map((c) => categories[c]);
  const reasons = EVA_CATEGORIES.filter((c) => categories[c] !== 'green');

  const prep = evaPrepStatus(readings, eva, now);

  let readiness: EvaReadiness;
  if (prep.readiness === 'symptoms') readiness = 'unfit';
  else if (assessments.length === 0 || member.noRecentData || levels.every((l) => l === 'pending'))
    readiness = 'no-data';
  else if (levels.includes('red')) readiness = 'unfit';
  else if (reasons.length > 0 || prep.readiness === 'incomplete') readiness = 'review';
  else readiness = 'fit';

  return { ...member, categories, readiness, reasons, prep };
}

export function readinessLevel(row: Pick<EvaRow, 'readiness' | 'noRecentData'>) {
  switch (row.readiness) {
    case 'fit':
      return 'green' as const;
    case 'review':
      return 'amber' as const;
    case 'unfit':
      return 'red' as const;
    default:
      return row.noRecentData ? ('no-data' as const) : ('pending' as const);
  }
}
