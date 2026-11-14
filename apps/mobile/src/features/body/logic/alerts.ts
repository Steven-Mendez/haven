import type { Assessment, Config, Indicator, Level } from '@haven/core';

export const SEVERITY: Record<Level, number> = { red: 3, amber: 2, pending: 1, green: 0 };

export type Alert = {
  assessment: Assessment;
  indicator: Indicator;
  zone: string;
};

export function activeAlerts(assessments: Assessment[], config: Config): Alert[] {
  const zoneOrder = new Map(config.zones.map((z, i) => [z.id, i]));
  const indicatorOrder = new Map(config.indicators.map((ind, i) => [ind.id, i]));
  const alerts: Alert[] = [];
  for (const assessment of assessments) {
    if (assessment.level !== 'amber' && assessment.level !== 'red') continue;
    const indicator = config.indicators.find((i) => i.id === assessment.indicator);
    if (!indicator) continue;
    alerts.push({ assessment, indicator, zone: indicator.zone });
  }
  return alerts.sort(
    (a, b) =>
      SEVERITY[b.assessment.level] - SEVERITY[a.assessment.level] ||
      (zoneOrder.get(a.zone) ?? 99) - (zoneOrder.get(b.zone) ?? 99) ||
      (indicatorOrder.get(a.indicator.id) ?? 999) - (indicatorOrder.get(b.indicator.id) ?? 999),
  );
}

export function hasRed(alerts: Alert[]): boolean {
  return alerts.some((a) => a.assessment.level === 'red');
}
