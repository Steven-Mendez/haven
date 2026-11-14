import {
  type Assessment,
  BATTERY_INDICATORS,
  type Config,
  type Level,
  worstLevel,
} from '@haven/core';

export type EvaCategory = 'heart' | 'lungs' | 'cognition' | 'sleep';
export const EVA_CATEGORIES: EvaCategory[] = ['heart', 'lungs', 'cognition', 'sleep'];

export type EvaReadiness = 'fit' | 'review' | 'unfit' | 'no-data';

export type EvaRow = {
  id: string;
  name: string;
  lastDataAt: string | null;
  noRecentData: boolean;
  categories: Record<EvaCategory, Level>;
  readiness: EvaReadiness;
  reasons: EvaCategory[];
};

export function categoryIndicators(config: Config): Record<EvaCategory, string[]> {
  const zone = (id: string) => config.zones.find((z) => z.id === id)?.indicators ?? [];
  return {
    heart: zone('heart'),
    lungs: zone('lungs'),
    cognition: [...BATTERY_INDICATORS],
    sleep: ['sleep'],
  };
}

export function evaRow(
  member: { id: string; name: string; lastDataAt: string | null; noRecentData: boolean },
  assessments: Assessment[],
  config: Config,
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

  let readiness: EvaReadiness;
  if (assessments.length === 0 || member.noRecentData || levels.every((l) => l === 'pending'))
    readiness = 'no-data';
  else if (levels.includes('red')) readiness = 'unfit';
  else if (reasons.length > 0) readiness = 'review';
  else readiness = 'fit';

  return { ...member, categories, readiness, reasons };
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
