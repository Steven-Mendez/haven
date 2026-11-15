import { ChartColumn, ChartLine, Gauge, Hash, Table2 } from 'lucide-react';
import type { KpiPanelType } from '@/lib/kpi';

export const PANEL_ICONS: Record<KpiPanelType, typeof ChartLine> = {
  timeseries: ChartLine,
  bars: ChartColumn,
  stat: Hash,
  gauge: Gauge,
  table: Table2,
};
