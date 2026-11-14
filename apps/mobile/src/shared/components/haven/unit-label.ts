import { unitLabel } from '@haven/core';
import { useCallback } from 'react';

import { useLanguage } from '@/shared/i18n';

/**
 * Display label for an `Indicator.unit` id in the active language («steps» → «pasos»,
 * «bpm» → «lpm»). Display only: `Reading.unit` keeps the id. Idempotent: an already translated
 * label is returned as is, so HAVEN components can translate whatever `unit` they receive.
 */
export function useUnitLabel(): (unit: string) => string {
  const language = useLanguage();
  return useCallback((unit: string) => (unit ? unitLabel(unit, language) : unit), [language]);
}
