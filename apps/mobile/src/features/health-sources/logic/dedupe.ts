import type { Reading, ReadingSource } from '@haven/core';

export const SAME_SAMPLE_MS = 90_000;
export const SAME_VALUE_TOLERANCE = 0.01;

const PRIORITY: Partial<Record<ReadingSource, number>> = { healthkit: 2, watch: 1 };

export function isDedupSource(source: ReadingSource): boolean {
  return PRIORITY[source] !== undefined;
}

function sameValue(a: Reading['value'], b: Reading['value']): boolean {
  if (typeof a === 'number' && typeof b === 'number') {
    const scale = Math.max(Math.abs(a), Math.abs(b), 1);
    return Math.abs(a - b) / scale <= SAME_VALUE_TOLERANCE;
  }
  return String(a) === String(b);
}

export function isSameSample(a: Reading, b: Reading): boolean {
  return (
    a.id !== b.id &&
    a.indicator === b.indicator &&
    a.crewMember === b.crewMember &&
    a.source !== b.source &&
    isDedupSource(a.source) &&
    isDedupSource(b.source) &&
    Math.abs(Date.parse(a.takenAt) - Date.parse(b.takenAt)) <= SAME_SAMPLE_MS &&
    sameValue(a.value, b.value)
  );
}

export type DedupeResult = {
  save: Reading[];
  supersede: string[];
};

export function dedupe(incoming: Reading[], existing: Reading[]): DedupeResult {
  const save: Reading[] = [];
  const supersede = new Set<string>();
  const candidates = existing.filter((r) => isDedupSource(r.source));
  const rank = (r: Reading) => PRIORITY[r.source] ?? 0;
  const ordered = [...incoming].sort((a, b) => rank(b) - rank(a));
  for (const reading of ordered) {
    if (!isDedupSource(reading.source)) {
      save.push(reading);
      continue;
    }
    const twins = [...candidates, ...save].filter((r) => isSameSample(r, reading));
    if (twins.some((r) => rank(r) >= rank(reading))) continue;
    for (const twin of twins) {
      if (save.includes(twin)) save.splice(save.indexOf(twin), 1);
      else supersede.add(twin.id);
    }
    save.push(reading);
  }
  return { save, supersede: [...supersede] };
}
