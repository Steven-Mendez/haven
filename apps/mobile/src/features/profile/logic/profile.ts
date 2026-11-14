import type { Assessment, Level, Reading } from '@haven/core';

const DAY_MS = 86_400_000;

function dayKey(ms: number): string {
  const d = new Date(ms);
  return `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`;
}

export function levelCounts(assessments: Assessment[]): Record<Level, number> {
  const counts: Record<Level, number> = { red: 0, amber: 0, pending: 0, green: 0 };
  for (const a of assessments) counts[a.level]++;
  return counts;
}

export function baselineCoverage(assessments: Assessment[]): { ready: number; total: number } {
  return {
    ready: assessments.filter((a) => a.baseline !== undefined).length,
    total: assessments.length,
  };
}

export function daysOfData(readings: Reading[], now: number): number {
  if (readings.length === 0) return 0;
  const first = Math.min(...readings.map((r) => Date.parse(r.takenAt)).filter(Number.isFinite));
  if (!Number.isFinite(first)) return 0;
  return Math.max(1, Math.floor((now - first) / DAY_MS) + 1);
}

export function readingStreak(readings: Reading[], now: number): number {
  const days = new Set(readings.map((r) => dayKey(Date.parse(r.takenAt))));
  let cursor = now;
  if (!days.has(dayKey(cursor))) cursor -= DAY_MS;
  let streak = 0;
  while (days.has(dayKey(cursor))) {
    streak++;
    cursor -= DAY_MS;
  }
  return streak;
}
