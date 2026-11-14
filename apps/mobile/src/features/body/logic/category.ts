import { categoryLabel, type Indicator } from '@haven/core';

export function categoryText(
  indicator: Pick<Indicator, 'categoryLabels'>,
  fallback: Pick<Indicator, 'categoryLabels'> | undefined,
  value: number | string,
  lang: 'es' | 'en',
): string {
  const source = indicator.categoryLabels ? indicator : (fallback ?? indicator);
  return categoryLabel(source, value, lang);
}
