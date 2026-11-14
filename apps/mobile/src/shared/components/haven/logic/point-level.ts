// Level of ONE chart point from the indicator's config rules (packages/core/config/indicators.json).
// Pure: imports only @haven/core types. Used to colour chart dots; the engine's full evaluation
// (baseline, symptoms, sustained deviations) still decides the indicator's level.
//   red   → outside the `outside` range of a red rule that needs no extra context
//           (no symptoms, no sustained duration, no baseline deviation, no categories)
//   amber → outside the reference (green) range
//   undefined → inside the reference range

import type { Indicator } from '@haven/core';

export function pointLevel(
  indicator: Pick<Indicator, 'green' | 'rules'>,
  value: number,
): 'red' | 'amber' | undefined {
  if (!Number.isFinite(value)) return undefined;
  const outside = (r: [number, number]) => value < r[0] || value > r[1];
  const redByValue = indicator.rules.some(
    (rule) =>
      rule.level === 'red' &&
      rule.outside !== undefined &&
      !rule.withSymptoms &&
      rule.sustainedMin === undefined &&
      rule.baselineDeviation === undefined &&
      !rule.categories?.length &&
      outside(rule.outside),
  );
  if (redByValue) return 'red';
  return outside(indicator.green) ? 'amber' : undefined;
}
