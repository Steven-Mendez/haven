import { useEffect, useMemo, useState } from 'react';

/**
 * Current time, refreshed every `everyMs` (default 1 min) and whenever `deps` change. Pass the
 * readings as a dependency: a reading just saved is stamped "now", and the engine ignores readings
 * newer than the `now` it receives.
 */
export function useNow(deps: unknown[] = [], everyMs = 60_000): Date {
  const [tick, setTick] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setTick((n) => n + 1), everyMs);
    return () => clearInterval(id);
  }, [everyMs]);
  // biome-ignore lint/correctness/useExhaustiveDependencies: recomputed on tick and on caller deps
  return useMemo(() => new Date(), [tick, ...deps]);
}
