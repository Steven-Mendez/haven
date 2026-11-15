import { describe, expect, it } from 'vitest';
import {
  defaultDashboard,
  KPI_COLUMNS,
  KPI_CREW_SOURCE,
  KPI_INDICATORS,
  KPI_LIMITS,
  type KpiDashboard,
  type KpiLayoutItem,
  validateDashboard,
} from './kpi';

const overlaps = (a: KpiLayoutItem, b: KpiLayoutItem) =>
  a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;

function expectPacked(dashboard: KpiDashboard) {
  const { layout } = dashboard;
  for (const [index, a] of layout.entries())
    for (const b of layout.slice(index + 1)) expect(overlaps(a, b)).toBe(false);
  const rows = new Map<number, number>();
  for (const l of layout) rows.set(l.y, (rows.get(l.y) ?? 0) + l.w);
  for (const width of rows.values()) expect(width).toBe(KPI_COLUMNS);
}

const base = (): KpiDashboard => ({
  version: 1,
  range: '30d',
  panels: [
    { id: 'a', type: 'timeseries', series: [{ indicator: 'heart-rate', source: KPI_CREW_SOURCE }] },
    { id: 'b', type: 'stat', series: [{ indicator: 'spo2', source: 'crew-1' }] },
  ],
  layout: [
    { i: 'a', x: 0, y: 0, w: 6, h: 6 },
    { i: 'b', x: 6, y: 0, w: 6, h: 6 },
  ],
});

describe('defaultDashboard', () => {
  it('validates and has no overlapping items', () => {
    const dashboard = defaultDashboard(KPI_INDICATORS);
    const checked = validateDashboard(dashboard);
    expect(checked).toEqual({ ok: true, dashboard });
    expect(dashboard.panels.map((p) => p.id)).toEqual([
      'stat-heart-rate',
      'stat-spo2',
      'stat-sleep',
      'stat-stress',
      'timeseries-heart-rate',
      'timeseries-sleep',
      'bars-steps',
      'table-vitals',
    ]);
    expect(dashboard.panels.find((p) => p.type === 'table')?.series).toHaveLength(5);
    expect(dashboard.panels.every((p) => p.series.every((s) => s.source === KPI_CREW_SOURCE))).toBe(
      true,
    );
    expectPacked(dashboard);
  });

  it('packs a reduced indicator list without gaps', () => {
    const dashboard = defaultDashboard(['heart-rate', 'stress', 'glucose']);
    expect(validateDashboard(dashboard).ok).toBe(true);
    expect(dashboard.panels.map((p) => p.id)).toEqual([
      'stat-heart-rate',
      'stat-stress',
      'timeseries-heart-rate',
      'table-vitals',
    ]);
    expectPacked(dashboard);
  });

  it('is empty without known indicators', () => {
    const dashboard = defaultDashboard([]);
    expect(dashboard.panels).toEqual([]);
    expect(validateDashboard(dashboard).ok).toBe(true);
  });
});

describe('validateDashboard', () => {
  it('accepts an empty dashboard', () => {
    expect(validateDashboard({ version: 1, range: 'all', panels: [], layout: [] }).ok).toBe(true);
  });

  it('strips unknown fields and trims titles', () => {
    const body = base() as unknown as Record<string, unknown>;
    const panels = body.panels as Record<string, unknown>[];
    body.extra = true;
    panels[0].title = '  Pulse  ';
    panels[0].colour = 'red';
    panels[1].title = '   ';
    (panels[1].series as Record<string, unknown>[])[0].unit = 'x';
    (body.layout as Record<string, unknown>[])[0].static = true;
    const checked = validateDashboard(body);
    expect(checked.ok).toBe(true);
    if (!checked.ok) return;
    expect(checked.dashboard).toEqual({
      ...base(),
      panels: [{ ...base().panels[0], title: 'Pulse' }, base().panels[1]],
    });
  });

  const many = (n: number) => {
    const d = base();
    d.panels = Array.from({ length: n }, (_, i) => ({ ...d.panels[0], id: `p${i}` }));
    d.layout = d.panels.map((p, i) => ({ i: p.id, x: 0, y: i * 2, w: 2, h: 2 }));
    return d;
  };
  const series = (n: number) =>
    Array.from({ length: n }, () => ({ indicator: 'mood', source: KPI_CREW_SOURCE }));

  const cases: [string, string, (d: KpiDashboard & Record<string, unknown>) => unknown][] = [
    ['non-object', 'dashboard', () => 'dashboard'],
    ['wrong version', 'version', (d) => ({ ...d, version: 2 })],
    ['unknown range', 'range', (d) => ({ ...d, range: '90d' })],
    ['panels not an array', 'panels:', (d) => ({ ...d, panels: {} })],
    ['too many panels', 'panels:', () => many(KPI_LIMITS.panels + 1)],
    [
      'empty panel id',
      'panels[0].id',
      (d) => {
        d.panels[0].id = '';
      },
    ],
    [
      'long panel id',
      'panels[0].id',
      (d) => {
        d.panels[0].id = 'a'.repeat(KPI_LIMITS.id + 1);
      },
    ],
    [
      'bad panel id chars',
      'panels[0].id',
      (d) => {
        d.panels[0].id = 'a b';
      },
    ],
    [
      'duplicate panel id',
      'panels[1].id',
      (d) => {
        d.panels[1].id = 'a';
      },
    ],
    [
      'unknown type',
      'panels[0].type',
      (d) => {
        (d.panels[0] as { type: string }).type = 'pie';
      },
    ],
    [
      'non-string title',
      'panels[0].title',
      (d) => {
        (d.panels[0] as { title: unknown }).title = 3;
      },
    ],
    [
      'long title',
      'panels[0].title',
      (d) => {
        d.panels[0].title = 'x'.repeat(KPI_LIMITS.title + 1);
      },
    ],
    [
      'no series',
      'panels[0].series',
      (d) => {
        d.panels[0].series = [];
      },
    ],
    [
      'too many series',
      'panels[0].series',
      (d) => {
        d.panels[0].series = series(KPI_LIMITS.series + 1);
      },
    ],
    [
      'two series on a stat',
      'panels[1].series',
      (d) => {
        d.panels[1].series = series(2);
      },
    ],
    [
      'series without source',
      'panels[0].series',
      (d) => {
        d.panels[0].series = [{ indicator: 'mood' } as never];
      },
    ],
    [
      'empty indicator',
      'panels[0].series',
      (d) => {
        d.panels[0].series = [{ indicator: '', source: 'crew' }];
      },
    ],
    [
      'long source',
      'panels[0].series',
      (d) => {
        d.panels[0].series = [{ indicator: 'm', source: 'x'.repeat(81) }];
      },
    ],
    [
      'bad panel range',
      'panels[0].range',
      (d) => {
        (d.panels[0] as { range: string }).range = '1y';
      },
    ],
    [
      'non-boolean reference',
      'panels[0].reference',
      (d) => {
        (d.panels[0] as { reference: unknown }).reference = 1;
      },
    ],
    [
      'non-boolean markers',
      'panels[0].markers',
      (d) => {
        (d.panels[0] as { markers: unknown }).markers = 'yes';
      },
    ],
    ['layout not an array', 'layout:', (d) => ({ ...d, layout: null })],
    [
      'missing layout item',
      'layout: missing',
      (d) => {
        d.layout.pop();
      },
    ],
    [
      'extra layout item',
      'layout[2].i',
      (d) => {
        d.layout.push({ i: 'z', x: 0, y: 6, w: 6, h: 6 });
      },
    ],
    [
      'duplicate layout item',
      'layout[1].i',
      (d) => {
        d.layout[1].i = 'a';
      },
    ],
    [
      'non-integer x',
      'layout[0].x',
      (d) => {
        d.layout[0].x = 0.5;
      },
    ],
    [
      'negative x',
      'layout[0].x',
      (d) => {
        d.layout[0].x = -1;
      },
    ],
    [
      'x + w beyond columns',
      'layout[1].x',
      (d) => {
        d.layout[1].x = 7;
      },
    ],
    [
      'narrow w',
      'layout[0].w',
      (d) => {
        d.layout[0].w = KPI_LIMITS.minW - 1;
      },
    ],
    [
      'wide w',
      'layout[0].w',
      (d) => {
        d.layout[0].w = KPI_COLUMNS + 1;
      },
    ],
    [
      'short h',
      'layout[0].h',
      (d) => {
        d.layout[0].h = KPI_LIMITS.minH - 1;
      },
    ],
    [
      'tall h',
      'layout[0].h',
      (d) => {
        d.layout[0].h = KPI_LIMITS.maxH + 1;
      },
    ],
    [
      'negative y',
      'layout[0].y',
      (d) => {
        d.layout[0].y = -1;
      },
    ],
    [
      'far y',
      'layout[0].y',
      (d) => {
        d.layout[0].y = KPI_LIMITS.maxY + 1;
      },
    ],
    [
      'string coordinate',
      'layout[0].y',
      (d) => {
        (d.layout[0] as { y: unknown }).y = '0';
      },
    ],
  ];

  it.each(cases)('rejects %s', (_, field, mutate) => {
    const d = base() as KpiDashboard & Record<string, unknown>;
    const replaced = mutate(d);
    const checked = validateDashboard(replaced === undefined ? d : replaced);
    expect(checked.ok).toBe(false);
    if (!checked.ok) expect(checked.errors[0].startsWith(field)).toBe(true);
  });

  it('accepts the base fixture', () => {
    expect(validateDashboard(base()).ok).toBe(true);
  });
});
