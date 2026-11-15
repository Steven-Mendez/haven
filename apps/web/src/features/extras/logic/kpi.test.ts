import { describe, expect, it } from 'vitest';
import type { KpiDashboard, KpiSeriesData } from '@/lib/kpi';
import {
  addPanel,
  compatibleIndicators,
  dataEnd,
  defaultTitle,
  duplicatePanel,
  fitSeries,
  inRange,
  inWindow,
  type KpiIndicatorInfo,
  nextSeries,
  niceScale,
  panelId,
  placeAtBottom,
  retypePanel,
  sameDashboard,
  seriesPoints,
  seriesStats,
  stackOrder,
  tickDecimals,
  valueExtent,
  windowFor,
} from './kpi';

const info = (id: string, unitId: string, green: [number, number] | null = null) =>
  ({
    id,
    name: id.toUpperCase(),
    unit: unitId,
    unitId,
    zone: 'z',
    zoneName: 'Z',
    green,
    decimals: 0,
  }) satisfies KpiIndicatorInfo;

const indicators = [info('hr', 'bpm', [50, 90]), info('rhr', 'bpm'), info('sleep', 'h')];

const data: KpiSeriesData = {
  mission: 'm',
  crew: {
    hr: [
      { date: '2026-03-03', mean: 70 },
      { date: '2026-03-01', mean: 60 },
      { date: '2026-03-10', mean: 80 },
    ],
    sleep: null,
  },
  members: { ana: { sleep: [{ date: '2026-03-12', mean: 7 }] } },
};

const dashboard = (panels: KpiDashboard['panels'], layout: KpiDashboard['layout']) =>
  ({ version: 1, range: '7d', panels, layout }) satisfies KpiDashboard;

describe('windows', () => {
  it('sorts points and returns null when a series has no data', () => {
    expect(seriesPoints(data, { indicator: 'hr', source: 'crew' })?.map((p) => p.date)).toEqual([
      '2026-03-01',
      '2026-03-03',
      '2026-03-10',
    ]);
    expect(seriesPoints(data, { indicator: 'sleep', source: 'crew' })).toBeNull();
    expect(seriesPoints(data, { indicator: 'hr', source: 'nobody' })).toBeNull();
  });

  it('ends at the latest day among the dashboard series, not today', () => {
    const d = dashboard(
      [{ id: 'a', type: 'stat', series: [{ indicator: 'hr', source: 'crew' }] }],
      [],
    );
    expect(dataEnd(data, d)).toBe('2026-03-10');
    expect(dataEnd(data, dashboard([], []))).toBe('2026-03-12');
  });

  it('builds inclusive windows and filters to them', () => {
    expect(windowFor('7d', '2026-03-10')).toEqual({ from: '2026-03-04', to: '2026-03-10' });
    expect(windowFor('all', '2026-03-10')).toEqual({ from: null, to: '2026-03-10' });
    expect(windowFor('30d', null)).toEqual({ from: null, to: null });
    const points = seriesPoints(data, { indicator: 'hr', source: 'crew' });
    expect(inWindow(points, windowFor('7d', '2026-03-10'))).toHaveLength(1);
    expect(inWindow(points, windowFor('all', '2026-03-10'))).toHaveLength(3);
    expect(inWindow(null, windowFor('all', '2026-03-10'))).toEqual([]);
  });
});

describe('stats', () => {
  it('computes last, first, min, max, mean and delta', () => {
    const stats = seriesStats(seriesPoints(data, { indicator: 'hr', source: 'crew' }) ?? []);
    expect(stats).toMatchObject({ min: 60, max: 80, mean: 70, delta: 20, count: 3 });
    expect(stats?.last.date).toBe('2026-03-10');
    expect(seriesStats([])).toBeNull();
  });

  it('checks the reference range', () => {
    expect(inRange(70, [50, 90])).toBe(true);
    expect(inRange(95, [50, 90])).toBe(false);
    expect(inRange(95, null)).toBeNull();
  });

  it('produces clean ticks that contain the values', () => {
    expect(niceScale(61, 79).ticks).toEqual([60, 70, 80]);
    const bars = niceScale(3200, 9100, { zero: true });
    expect(bars.domain[0]).toBe(0);
    expect(bars.domain[1]).toBeGreaterThanOrEqual(9100);
    const flat = niceScale(5, 5);
    expect(flat.domain[0]).toBeLessThan(5);
    expect(flat.domain[1]).toBeGreaterThan(5);
    expect(niceScale(0.1, 0.35).ticks.every((t) => Number.isFinite(t))).toBe(true);
    expect(tickDecimals([0, 2.5, 5])).toBe(1);
    expect(tickDecimals([60, 70, 80])).toBe(0);
  });

  it('keeps far reference bounds out of the value extent', () => {
    // Heart rate: both bounds are within one data span of the data.
    expect(valueExtent([60, 81], [50, 100])).toEqual([50, 100]);
    // Steps: the upper bound is far away; the lower one is inside the data.
    expect(valueExtent([5200, 8100], [6000, 100000])).toEqual([5200, 8100]);
    expect(valueExtent([5200, 8100], [3000, 100000])).toEqual([3000, 8100]);
    // Sleep: 12 h is more than one span (2 h) above 8.5 h.
    expect(valueExtent([6.5, 8.5], [7, 12])).toEqual([6.5, 8.5]);
    // Flat series use 10 % of the value as the minimum span.
    expect(valueExtent([97, 97], [95, 100])).toEqual([95, 100]);
    expect(valueExtent([97, 97], [50, 100])).toEqual([97, 100]);
    expect(valueExtent([], [1, 2])).toEqual([1, 2]);
  });
});

describe('panels', () => {
  it('adds another source when no other same-unit indicator has data', () => {
    const panel = {
      id: 'p',
      type: 'timeseries' as const,
      series: [{ indicator: 'hr', source: 'crew' }],
    };
    expect(nextSeries(panel, indicators, new Set(['hr']), ['crew', 'ana'])).toEqual({
      indicator: 'hr',
      source: 'ana',
    });
    expect(nextSeries(panel, indicators, new Set(['hr', 'rhr']), ['crew', 'ana'])).toEqual({
      indicator: 'rhr',
      source: 'crew',
    });
    const full = {
      ...panel,
      series: [
        { indicator: 'hr', source: 'crew' },
        { indicator: 'hr', source: 'ana' },
        { indicator: 'rhr', source: 'crew' },
        { indicator: 'rhr', source: 'ana' },
      ],
    };
    expect(nextSeries(full, indicators, new Set(['hr', 'rhr']), ['crew', 'ana'])).toBeNull();
  });

  const byId = new Map(indicators.map((i) => [i.id, i]));
  const sources = new Map([['ana', { id: 'ana', name: 'Ana' }]]);

  it('derives a default title', () => {
    const one = { type: 'stat' as const, series: [{ indicator: 'hr', source: 'crew' }] };
    expect(defaultTitle(one, byId, sources, 'Stat')).toBe('HR');
    const member = { type: 'stat' as const, series: [{ indicator: 'hr', source: 'ana' }] };
    expect(defaultTitle(member, byId, sources, 'Stat')).toBe('HR · Ana');
    const same = {
      type: 'timeseries' as const,
      series: [
        { indicator: 'hr', source: 'crew' },
        { indicator: 'hr', source: 'ana' },
      ],
    };
    expect(defaultTitle(same, byId, sources, 'Lines')).toBe('HR');
    const mixed = {
      type: 'table' as const,
      series: [
        { indicator: 'hr', source: 'crew' },
        { indicator: 'sleep', source: 'crew' },
      ],
    };
    expect(defaultTitle(mixed, byId, sources, 'Table')).toBe('Table');
  });

  it('only offers same-unit indicators for chart panels', () => {
    const series = [{ indicator: 'hr', source: 'crew' }];
    expect(compatibleIndicators('timeseries', series, indicators).map((i) => i.id)).toEqual([
      'hr',
      'rhr',
    ]);
    expect(compatibleIndicators('table', series, indicators)).toHaveLength(3);
    const mixed = [...series, { indicator: 'sleep', source: 'crew' }];
    expect(fitSeries('bars', mixed, indicators)).toEqual(series);
    expect(fitSeries('stat', mixed, indicators)).toEqual(series);
    expect(fitSeries('table', mixed, indicators)).toEqual(mixed);
  });

  it('retypes a panel, keeping markers only for time series', () => {
    const panel = {
      id: 'p',
      type: 'timeseries' as const,
      series: [{ indicator: 'hr', source: 'crew' }],
      markers: true,
    };
    expect(retypePanel(panel, 'bars', indicators).markers).toBeUndefined();
    expect(retypePanel(panel, 'timeseries', indicators).markers).toBe(true);
  });

  it('places new panels at the bottom and trims generated ids', () => {
    expect(placeAtBottom([{ i: 'a', x: 0, y: 2, w: 6, h: 4 }], 'b', 3, 3)).toEqual({
      i: 'b',
      x: 0,
      y: 6,
      w: 3,
      h: 3,
    });
    expect(panelId('1B2C3D4E-AAAA-BBBB-CCCC-DDDDEEEEFFFF-extra-long-suffix')).toMatch(
      /^[a-z0-9-]{1,40}$/,
    );
    const d = addPanel(dashboard([], []), { id: 'x', type: 'gauge', series: [] });
    expect(d.layout).toEqual([{ i: 'x', x: 0, y: 0, w: 3, h: 4 }]);
  });

  it('duplicates a panel below the original', () => {
    const d = dashboard(
      [
        { id: 'a', type: 'stat', series: [] },
        { id: 'b', type: 'stat', series: [] },
      ],
      [
        { i: 'a', x: 0, y: 0, w: 3, h: 3 },
        { i: 'b', x: 0, y: 3, w: 3, h: 3 },
      ],
    );
    const next = duplicatePanel(d, 'a', 'a2');
    expect(next.panels.map((p) => p.id)).toEqual(['a', 'a2', 'b']);
    expect(next.layout.find((l) => l.i === 'a2')).toEqual({ i: 'a2', x: 0, y: 3, w: 3, h: 3 });
    expect(next.layout.find((l) => l.i === 'b')?.y).toBe(6);
  });

  it('orders panels for a single column by row, then column', () => {
    const d = dashboard(
      [
        { id: 'c', type: 'stat', series: [] },
        { id: 'b', type: 'stat', series: [] },
        { id: 'a', type: 'stat', series: [] },
      ],
      [
        { i: 'a', x: 0, y: 0, w: 6, h: 3 },
        { i: 'b', x: 6, y: 0, w: 6, h: 3 },
        { i: 'c', x: 0, y: 3, w: 6, h: 3 },
      ],
    );
    expect(stackOrder(d)).toEqual(['a', 'b', 'c']);
  });

  it('compares dashboards ignoring key order, undefined keys and layout order', () => {
    const a = dashboard(
      [{ id: 'a', type: 'stat', series: [{ indicator: 'hr', source: 'crew' }], title: undefined }],
      [
        { i: 'a', x: 0, y: 0, w: 3, h: 3 },
        { i: 'b', x: 3, y: 0, w: 3, h: 3 },
      ],
    );
    const b = dashboard(
      [{ series: [{ source: 'crew', indicator: 'hr' }], type: 'stat', id: 'a' }],
      [
        { i: 'b', x: 3, y: 0, w: 3, h: 3 },
        { i: 'a', x: 0, y: 0, w: 3, h: 3 },
      ],
    );
    expect(sameDashboard(a, b)).toBe(true);
    expect(sameDashboard(a, { ...b, range: '30d' })).toBe(false);
    expect(sameDashboard(a, { ...b, layout: [{ i: 'a', x: 0, y: 0, w: 4, h: 3 }] })).toBe(false);
  });
});
