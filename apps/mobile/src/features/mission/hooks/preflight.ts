import { useCallback, useEffect, useState } from 'react';
import { db } from '@/shared/db';
import { mergePreflight, type PreflightBaseline } from '../logic/preflight';

const collection = db.collection<PreflightBaseline>('preflight_baselines');

export function usePreflightBaseline(crewMember: string, refresh?: unknown) {
  const [baseline, setBaseline] = useState<PreflightBaseline | undefined>();

  // biome-ignore lint/correctness/useExhaustiveDependencies: `refresh` only triggers a reload
  useEffect(() => {
    let cancelled = false;
    setBaseline(undefined);
    collection
      .get(crewMember)
      .then((value) => {
        if (!cancelled) setBaseline(value);
      })
      .catch((error) => console.warn('[mission] could not load the pre-flight baseline', error));
    return () => {
      cancelled = true;
    };
  }, [crewMember, refresh]);

  const save = useCallback(
    async (edits: Record<string, string>) => {
      const next = mergePreflight(baseline, crewMember, edits, new Date());
      await collection.put(crewMember, next);
      setBaseline(next);
      return next;
    },
    [baseline, crewMember],
  );

  return { baseline, save };
}
