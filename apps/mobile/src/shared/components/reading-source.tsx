import type { Reading } from '@haven/core';
import { DataLabel } from '@/shared/components/haven/data-label';
import { useAgeMin } from '@/shared/data';

type Props = { reading: Reading | undefined; onPressOrigin?: () => void; className?: string };

/**
 * Source · age of a reading, with a live age (refreshes every 30 s).
 * Thin wrapper over the designer's `DataLabel`. Definition of Done: always next to a value.
 */
export function ReadingSource({ reading, onPressOrigin, className }: Props) {
  const ageMin = useAgeMin(reading?.takenAt);
  return (
    <DataLabel
      source={reading?.source}
      ageMin={reading ? ageMin : undefined}
      // «Producto real»: `simulated` is frozen at false and never shown.
      simulated={false}
      onPressOrigin={onPressOrigin}
      className={className}
    />
  );
}
