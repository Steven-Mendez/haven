import {
  type Reading,
  type WorkDay,
  type WorkloadStatus,
  workDays,
  workload,
  workloadStatus,
} from '@haven/core';

export type WorkloadRow = {
  id: string;
  name: string;
  lastDataAt: string | null;
  noRecentData: boolean;
  days: WorkDay[];
  status: WorkloadStatus;
};

export function workloadRow(
  member: { id: string; name: string; lastDataAt: string | null; noRecentData: boolean },
  readings: Reading[],
  now: Date,
): WorkloadRow {
  const days = workDays(readings, now);
  return { ...member, days, status: workloadStatus(days, workload) };
}
