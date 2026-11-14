import { categoryLabel, type Indicator } from '@haven/core';

/**
 * `categoryLabel` from `@haven/core`, taking the labels from `fallback` (the bundled indicator)
 * when the active one has none: rules received from Earth may predate `categoryLabels`.
 */
export function categoryText(
  indicator: Pick<Indicator, 'categoryLabels'>,
  fallback: Pick<Indicator, 'categoryLabels'> | undefined,
  value: number | string,
  lang: 'es' | 'en',
): string {
  const source = indicator.categoryLabels ? indicator : (fallback ?? indicator);
  return categoryLabel(source, value, lang);
}
