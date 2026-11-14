import type { Reading } from '@haven/core';
import { DataLabel } from '@/shared/components/haven/data-label';
import { useAgeMin } from '@/shared/data';

type Props = { reading: Reading | undefined; onPressOrigin?: () => void; className?: string };

export function ReadingSource({ reading, onPressOrigin, className }: Props) {
  const ageMin = useAgeMin(reading?.takenAt);
  return (
    <DataLabel
      source={reading?.source}
      ageMin={reading ? ageMin : undefined}
      simulated={false}
      onPressOrigin={onPressOrigin}
      className={className}
    />
  );
}
