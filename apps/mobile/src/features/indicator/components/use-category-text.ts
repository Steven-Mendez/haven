import type { Indicator } from '@haven/core';
import { baseConfig } from '@/shared/config';
import { useLanguage } from '@/shared/i18n';
import { categoryText } from '../logic/category';

export function useCategoryText() {
  const language = useLanguage();
  return (indicator: Indicator, value: number | string): string =>
    categoryText(
      indicator,
      baseConfig.indicators.find((i) => i.id === indicator.id),
      value,
      language,
    );
}
