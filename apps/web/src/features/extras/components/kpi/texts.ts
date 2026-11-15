import type { KpiPanelType, KpiRange } from '@/lib/kpi';
import type { ExtrasTexts } from '../../i18n';

const SHARED = ['noGroupStat', 'exportCsv', 'meanOfCrew', 'cancel'] as const;

/** The plain strings the client dashboard needs: every `kpi…` key plus a few shared ones. */
export type KpiTexts = {
  [K in keyof ExtrasTexts as K extends `kpi${string}` ? K : never]: string;
} & Pick<ExtrasTexts, (typeof SHARED)[number]>;

export function kpiTexts(t: ExtrasTexts): KpiTexts {
  const picked: Record<string, string> = {};
  for (const [key, value] of Object.entries(t)) {
    if (key.startsWith('kpi') || (SHARED as readonly string[]).includes(key)) picked[key] = value;
  }
  return picked as KpiTexts;
}

export const rangeLabel = (t: KpiTexts, range: KpiRange) =>
  ({ '7d': t.kpiRange7d, '14d': t.kpiRange14d, '30d': t.kpiRange30d, all: t.kpiRangeAll })[range];

export const rangeLong = (t: KpiTexts, range: KpiRange) =>
  ({
    '7d': t.kpiRangeLong7d,
    '14d': t.kpiRangeLong14d,
    '30d': t.kpiRangeLong30d,
    all: t.kpiRangeLongAll,
  })[range];

export const typeName = (t: KpiTexts, type: KpiPanelType) =>
  ({
    timeseries: t.kpiTypeTimeseries,
    bars: t.kpiTypeBars,
    stat: t.kpiTypeStat,
    gauge: t.kpiTypeGauge,
    table: t.kpiTypeTable,
  })[type];

export const typeDetail = (t: KpiTexts, type: KpiPanelType) =>
  ({
    timeseries: t.kpiTypeTimeseriesDetail,
    bars: t.kpiTypeBarsDetail,
    stat: t.kpiTypeStatDetail,
    gauge: t.kpiTypeGaugeDetail,
    table: t.kpiTypeTableDetail,
  })[type];
