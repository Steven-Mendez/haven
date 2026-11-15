export const KPI_RANGES = ['7d', '14d', '30d', 'all'] as const;
export type KpiRange = (typeof KPI_RANGES)[number];

export const KPI_PANEL_TYPES = ['timeseries', 'bars', 'stat', 'gauge', 'table'] as const;
export type KpiPanelType = (typeof KPI_PANEL_TYPES)[number];

export const KPI_CREW_SOURCE = 'crew';

export type KpiSeries = { indicator: string; source: string };

export type KpiPanel = {
  id: string;
  type: KpiPanelType;
  title?: string;
  series: KpiSeries[];
  range?: KpiRange;
  reference?: boolean;
  markers?: boolean;
};

export type KpiLayoutItem = { i: string; x: number; y: number; w: number; h: number };

export type KpiDashboard = {
  version: 1;
  range: KpiRange;
  panels: KpiPanel[];
  layout: KpiLayoutItem[];
};

export const KPI_COLUMNS = 12;

export const KPI_LIMITS = {
  panels: 24,
  series: 5,
  title: 80,
  id: 40,
  minW: 2,
  minH: 2,
  maxH: 12,
  maxY: 400,
} as const;

export const KPI_SINGLE_SERIES: readonly KpiPanelType[] = ['stat', 'gauge'];

export const KPI_INDICATORS = [
  'heart-rate',
  'systolic-bp',
  'spo2',
  'body-temperature',
  'sleep',
  'mood',
  'stress',
  'steps',
  'resistance-exercise',
  'reaction-time',
  'glucose',
  'food-intake',
  'hydration',
  'radiation-dose',
  'cabin-pressure',
];

export type KpiDailyPoint = { date: string; mean: number };

export type KpiSeriesData = {
  mission: string;
  crew: Record<string, KpiDailyPoint[] | null>;
  members: Record<string, Record<string, KpiDailyPoint[]>>;
};

type Check = { ok: true; dashboard: KpiDashboard } | { ok: false; errors: string[] };

const isObject = (v: unknown): v is Record<string, unknown> =>
  typeof v === 'object' && v !== null && !Array.isArray(v);
const isText = (v: unknown, max: number): v is string =>
  typeof v === 'string' && v.length > 0 && v.length <= max;
const isInt = (v: unknown, min: number, max: number): v is number =>
  typeof v === 'number' && Number.isInteger(v) && v >= min && v <= max;
const isRange = (v: unknown): v is KpiRange => (KPI_RANGES as readonly unknown[]).includes(v);
const isPanelType = (v: unknown): v is KpiPanelType =>
  (KPI_PANEL_TYPES as readonly unknown[]).includes(v);

const PANEL_ID = /^[a-z0-9-]+$/i;

function checkPanel(raw: unknown, at: string, errors: string[]): KpiPanel | null {
  if (!isObject(raw)) {
    errors.push(`${at}: object`);
    return null;
  }
  const start = errors.length;
  if (!isText(raw.id, KPI_LIMITS.id) || !PANEL_ID.test(raw.id))
    errors.push(`${at}.id: 1-${KPI_LIMITS.id} chars [a-z0-9-]`);
  if (!isPanelType(raw.type)) errors.push(`${at}.type: ${KPI_PANEL_TYPES.join(' | ')}`);
  if (
    raw.title !== undefined &&
    (typeof raw.title !== 'string' || raw.title.trim().length > KPI_LIMITS.title)
  )
    errors.push(`${at}.title: string up to ${KPI_LIMITS.title} chars`);
  const max = isPanelType(raw.type) && KPI_SINGLE_SERIES.includes(raw.type) ? 1 : KPI_LIMITS.series;
  if (!Array.isArray(raw.series) || raw.series.length < 1 || raw.series.length > max)
    errors.push(`${at}.series: 1-${max} items`);
  else if (!raw.series.every((s) => isObject(s) && isText(s.indicator, 80) && isText(s.source, 80)))
    errors.push(`${at}.series: each one needs indicator and source`);
  if (raw.range !== undefined && !isRange(raw.range))
    errors.push(`${at}.range: ${KPI_RANGES.join(' | ')}`);
  if (raw.reference !== undefined && typeof raw.reference !== 'boolean')
    errors.push(`${at}.reference: boolean`);
  if (raw.markers !== undefined && typeof raw.markers !== 'boolean')
    errors.push(`${at}.markers: boolean`);
  if (errors.length > start) return null;

  const title = typeof raw.title === 'string' ? raw.title.trim() : '';
  return {
    id: raw.id as string,
    type: raw.type as KpiPanelType,
    ...(title ? { title } : {}),
    series: (raw.series as KpiSeries[]).map((s) => ({ indicator: s.indicator, source: s.source })),
    ...(raw.range !== undefined ? { range: raw.range as KpiRange } : {}),
    ...(raw.reference !== undefined ? { reference: raw.reference as boolean } : {}),
    ...(raw.markers !== undefined ? { markers: raw.markers as boolean } : {}),
  };
}

function checkLayoutItem(raw: unknown, at: string, errors: string[]): KpiLayoutItem | null {
  if (!isObject(raw)) {
    errors.push(`${at}: object`);
    return null;
  }
  const start = errors.length;
  if (typeof raw.i !== 'string') errors.push(`${at}.i: panel id`);
  if (!isInt(raw.w, KPI_LIMITS.minW, KPI_COLUMNS))
    errors.push(`${at}.w: integer ${KPI_LIMITS.minW}-${KPI_COLUMNS}`);
  if (!isInt(raw.x, 0, KPI_COLUMNS - (isInt(raw.w, 0, KPI_COLUMNS) ? raw.w : 0)))
    errors.push(`${at}.x: integer, x + w <= ${KPI_COLUMNS}`);
  if (!isInt(raw.h, KPI_LIMITS.minH, KPI_LIMITS.maxH))
    errors.push(`${at}.h: integer ${KPI_LIMITS.minH}-${KPI_LIMITS.maxH}`);
  if (!isInt(raw.y, 0, KPI_LIMITS.maxY)) errors.push(`${at}.y: integer 0-${KPI_LIMITS.maxY}`);
  if (errors.length > start) return null;
  return {
    i: raw.i as string,
    x: raw.x as number,
    y: raw.y as number,
    w: raw.w as number,
    h: raw.h as number,
  };
}

export function validateDashboard(body: unknown): Check {
  if (!isObject(body)) return { ok: false, errors: ['dashboard must be an object'] };
  const errors: string[] = [];
  if (body.version !== 1) errors.push('version: 1');
  if (!isRange(body.range)) errors.push(`range: ${KPI_RANGES.join(' | ')}`);

  const panels: KpiPanel[] = [];
  if (!Array.isArray(body.panels) || body.panels.length > KPI_LIMITS.panels)
    errors.push(`panels: array of at most ${KPI_LIMITS.panels}`);
  else
    body.panels.forEach((raw, index) => {
      const panel = checkPanel(raw, `panels[${index}]`, errors);
      if (!panel) return;
      if (panels.some((p) => p.id === panel.id))
        errors.push(`panels[${index}].id: duplicate ${panel.id}`);
      else panels.push(panel);
    });

  const layout: KpiLayoutItem[] = [];
  if (!Array.isArray(body.layout)) errors.push('layout: array');
  else {
    const ids = new Set(
      (Array.isArray(body.panels) ? body.panels : []).flatMap((p) =>
        isObject(p) && typeof p.id === 'string' ? [p.id] : [],
      ),
    );
    body.layout.forEach((raw, index) => {
      const item = checkLayoutItem(raw, `layout[${index}]`, errors);
      if (!item) return;
      if (!ids.has(item.i)) errors.push(`layout[${index}].i: unknown panel ${item.i}`);
      else if (layout.some((l) => l.i === item.i))
        errors.push(`layout[${index}].i: duplicate ${item.i}`);
      else layout.push(item);
    });
    for (const id of ids)
      if (!body.layout.some((l) => isObject(l) && l.i === id))
        errors.push(`layout: missing panel ${id}`);
  }

  if (errors.length) return { ok: false, errors };
  return {
    ok: true,
    dashboard: { version: 1, range: body.range as KpiRange, panels, layout },
  };
}

const DEFAULT_STATS = ['heart-rate', 'spo2', 'sleep', 'stress'];
const DEFAULT_TIMESERIES = ['heart-rate', 'sleep'];
const DEFAULT_TABLE = [
  'heart-rate',
  'systolic-bp',
  'spo2',
  'body-temperature',
  'sleep',
  'mood',
  'stress',
];

export function defaultDashboard(indicators: string[]): KpiDashboard {
  const known = new Set(indicators);
  const crew = (indicator: string): KpiSeries => ({ indicator, source: KPI_CREW_SOURCE });
  const rows: { panel: KpiPanel; h: number }[][] = [
    DEFAULT_STATS.filter((i) => known.has(i)).map((i) => ({
      panel: { id: `stat-${i}`, type: 'stat', series: [crew(i)] },
      h: 3,
    })),
  ];
  const wide: { panel: KpiPanel; h: number }[] = [
    ...DEFAULT_TIMESERIES.filter((i) => known.has(i)).map((i) => ({
      panel: { id: `timeseries-${i}`, type: 'timeseries' as const, series: [crew(i)] },
      h: 6,
    })),
    ...(known.has('steps')
      ? [{ panel: { id: 'bars-steps', type: 'bars' as const, series: [crew('steps')] }, h: 6 }]
      : []),
  ];
  const table = DEFAULT_TABLE.filter((i) => known.has(i)).slice(0, 5);
  if (table.length)
    wide.push({ panel: { id: 'table-vitals', type: 'table', series: table.map(crew) }, h: 6 });
  for (let i = 0; i < wide.length; i += 2) rows.push(wide.slice(i, i + 2));

  const panels: KpiPanel[] = [];
  const layout: KpiLayoutItem[] = [];
  let y = 0;
  for (const row of rows) {
    if (!row.length) continue;
    const w = KPI_COLUMNS / row.length;
    row.forEach(({ panel, h }, index) => {
      panels.push(panel);
      layout.push({ i: panel.id, x: index * w, y, w, h });
    });
    y += Math.max(...row.map((r) => r.h));
  }
  return { version: 1, range: '30d', panels, layout };
}
