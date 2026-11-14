import { unitLabel } from '@haven/core';
import { useCallback } from 'react';

import { useLanguage } from '@/shared/i18n';

export function useUnitLabel(): (unit: string) => string {
  const language = useLanguage();
  return useCallback((unit: string) => (unit ? unitLabel(unit, language) : unit), [language]);
}
