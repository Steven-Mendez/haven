'use client';

import { Download } from 'lucide-react';
import type { ReactElement, ReactNode } from 'react';
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Line,
  LineChart,
  Pie,
  PieChart,
  ReferenceArea,
  ReferenceLine,
  Scatter,
  ScatterChart,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { Button } from '@/components/ui/button';
import { type ChartConfig, ChartContainer } from '@/components/ui/chart';
import { LegendKey } from '@/features/extras/components/kpi/kpi-chart';
import { formatNumber, type Language } from '@/lib/i18n';
import type { AssistantTexts } from '../i18n';
import type { ChartSpec } from '../types';
import { downloadCsv } from './panel-card';

type Row = { category: string } & Record<string, number | string | null>;

const key = (index: number) => `s${index}`;
const SERIES = (index: number) => `var(--kpi-series-${(index % 5) + 1})`;
const AXIS_TICK = { fill: 'var(--chart-axis)', fontSize: 11 };
const RING = { stroke: 'var(--card)', strokeWidth: 2 };

function decimalsOf(values: (number | null | undefined)[]): number {
  const numbers = values.filter((v): v is number => typeof v === 'number');
  if (numbers.length === 0 || numbers.every(Number.isInteger)) return 0;
  return Math.max(...numbers.map(Math.abs)) < 10 ? 2 : 1;
}

function Box({ children }: { children: ReactNode }) {
  return (
    <div className="bg-popover text-popover-foreground ring-border-strong flex flex-col gap-1 rounded-lg px-2.5 py-2 text-xs shadow-md ring-1">
      {children}
    </div>
  );
}

/**
 * A chart Orion builds from numbers it gathered with its other tools, for the
 * views the console does not have, in the visual language of the KPI charts.
 */
export function ChartCard({
  chart,
  lang,
  t,
}: {
  chart: ChartSpec;
  lang: Language;
  t: AssistantTexts;
}) {
  const { type } = chart;
  const count = chart.series.length;
  // Legend keys echo the mark: a swatch for bars and dots, a stroke for lines and areas.
  const mark = type === 'bars' || type === 'scatter' ? 'bar' : 'line';
  // One series alone wears the neutral ink; several take the fixed categorical order.
  const colorOf = (index: number) =>
    count > 1 ? SERIES(index) : type === 'bars' ? 'var(--chart-bar)' : 'var(--chart-line)';
  const unit = chart.unit ? ` ${chart.unit}` : '';

  const rows: Row[] = chart.categories.map((category, i) => {
    const row: Row = { category };
    chart.series.forEach((s, index) => {
      row[key(index)] = s.values[i] ?? null;
    });
    return row;
  });
  const decimals = decimalsOf([
    ...chart.series.flatMap((s) => s.values),
    ...chart.series.flatMap((s) => (s.points ?? []).map((p) => p[1])),
  ]);
  const fmt = (value: number, digits = decimals) => formatNumber(value, lang, digits);
  const tick = (v: number) => formatNumber(v, lang, Number.isInteger(v) ? 0 : decimals);
  const config = Object.fromEntries(
    chart.series.map((s, index) => [key(index), { label: s.name, color: colorOf(index) }]),
  ) satisfies ChartConfig;

  const csv = () => {
    const file = `${chart.title.replace(/[^\p{L}\p{N}]+/gu, '-').toLowerCase()}.csv`;
    if (type === 'scatter')
      return downloadCsv(file, [
        ['', chart.xLabel ?? 'x', chart.unit ?? 'y'],
        ...chart.series.flatMap((s) => (s.points ?? []).map(([x, y]) => [s.name, x, y])),
      ]);
    downloadCsv(file, [
      ['', ...chart.series.map((s) => (chart.unit ? `${s.name} (${chart.unit})` : s.name))],
      ...chart.categories.map((c, i) => [c, ...chart.series.map((s) => s.values[i] ?? '')]),
    ]);
  };

  const summary = `${chart.title}. ${chart.series
    .map((s) =>
      type === 'scatter'
        ? `${s.name}: ${(s.points ?? []).length}`
        : `${s.name}: ${chart.categories.map((c, i) => `${c} ${s.values[i] ?? '—'}`).join(', ')}`,
    )
    .join('; ')}`;

  const grid = (
    <CartesianGrid
      vertical={chart.horizontal === true || type === 'scatter'}
      horizontal={chart.horizontal !== true}
      stroke="var(--chart-grid)"
      strokeWidth={1}
    />
  );
  const categoryTooltip = (
    <Tooltip
      cursor={type === 'bars' ? { fill: 'var(--chart-band)' } : { stroke: 'var(--chart-cursor)' }}
      isAnimationActive={false}
      wrapperStyle={{ outline: 'none' }}
      content={({ active, payload, label }) =>
        active && payload?.length ? (
          <Box>
            <span className="text-muted-foreground">{label}</span>
            {chart.series.map((s, index) => {
              const value = (payload[0]?.payload as Row | undefined)?.[key(index)];
              return (
                <span key={s.name} className="flex items-center gap-2 tabular-nums">
                  <LegendKey color={colorOf(index)} kind={mark} />
                  {count > 1 ? <span className="text-muted-foreground">{s.name}</span> : null}
                  <span className="ml-auto font-medium">
                    {typeof value === 'number' ? `${fmt(value)}${unit}` : '—'}
                  </span>
                </span>
              );
            })}
          </Box>
        ) : null
      }
    />
  );
  // The green range, a limit or a target, drawn behind the data.
  const reference = chart.reference ? (
    chart.reference.from === chart.reference.to ? (
      <ReferenceLine
        {...(chart.horizontal ? { x: chart.reference.from } : { y: chart.reference.from })}
        stroke="var(--chart-reference)"
        strokeWidth={1}
        ifOverflow="extendDomain"
      />
    ) : (
      <ReferenceArea
        {...(chart.horizontal
          ? { x1: chart.reference.from, x2: chart.reference.to }
          : { y1: chart.reference.from, y2: chart.reference.to })}
        fill="var(--chart-band)"
        fillOpacity={1}
        strokeOpacity={0}
        ifOverflow="extendDomain"
      />
    )
  ) : null;
  const categoryAxis = (
    <XAxis
      dataKey="category"
      tickLine={false}
      axisLine={false}
      tickMargin={8}
      minTickGap={16}
      interval="preserveStartEnd"
      tick={AXIS_TICK}
    />
  );
  const valueAxis = (
    <YAxis
      orientation="right"
      width={48}
      tickLine={false}
      axisLine={false}
      tickMargin={8}
      tick={AXIS_TICK}
      tickFormatter={tick}
    />
  );
  const margin = { top: 6, right: 0, bottom: 0, left: 6 };

  let plot: ReactElement;
  let legend: { name: string; color: string; value?: string }[] = chart.series.map((s, index) => ({
    name: s.name,
    color: colorOf(index),
  }));

  if (type === 'donut') {
    const values = chart.series[0]?.values ?? [];
    const total = values.reduce<number>((sum, v) => sum + (v ?? 0), 0);
    const slices = chart.categories.map((name, i) => ({ name, value: values[i] ?? 0 }));
    legend = slices.map((s, index) => ({
      name: s.name,
      color: SERIES(index),
      value: `${fmt(s.value)}${unit} · ${formatNumber(total ? (s.value / total) * 100 : 0, lang, 0)} %`,
    }));
    plot = (
      <PieChart>
        <Tooltip
          isAnimationActive={false}
          wrapperStyle={{ outline: 'none' }}
          content={({ active, payload }) => {
            const slice = payload?.[0]?.payload as { name: string; value: number } | undefined;
            return active && slice ? (
              <Box>
                <span className="text-muted-foreground">{slice.name}</span>
                <span className="font-medium tabular-nums">
                  {fmt(slice.value)}
                  {unit} · {formatNumber(total ? (slice.value / total) * 100 : 0, lang, 0)} %
                </span>
              </Box>
            ) : null;
          }}
        />
        <Pie
          data={slices}
          dataKey="value"
          nameKey="name"
          innerRadius="62%"
          outerRadius="92%"
          startAngle={90}
          endAngle={-270}
          // A surface-colored gap, not a border, separates the slices.
          {...RING}
          animationDuration={400}
        >
          {slices.map((s, index) => (
            <Cell key={s.name} fill={SERIES(index)} />
          ))}
        </Pie>
      </PieChart>
    );
  } else if (type === 'scatter') {
    plot = (
      <ScatterChart margin={margin}>
        {grid}
        <XAxis
          type="number"
          dataKey="x"
          name={chart.xLabel}
          domain={['auto', 'auto']}
          tickLine={false}
          axisLine={false}
          tickMargin={8}
          tick={AXIS_TICK}
          tickFormatter={tick}
        />
        <YAxis
          type="number"
          dataKey="y"
          domain={['auto', 'auto']}
          orientation="right"
          width={48}
          tickLine={false}
          axisLine={false}
          tickMargin={8}
          tick={AXIS_TICK}
          tickFormatter={tick}
        />
        {reference}
        <Tooltip
          cursor={{ stroke: 'var(--chart-cursor)' }}
          isAnimationActive={false}
          wrapperStyle={{ outline: 'none' }}
          content={({ active, payload }) => {
            const point = payload?.[0]?.payload as { x: number; y: number; s: string } | undefined;
            return active && point ? (
              <Box>
                {count > 1 ? <span className="text-muted-foreground">{point.s}</span> : null}
                <span className="font-medium tabular-nums">
                  {chart.xLabel ? `${chart.xLabel}: ` : ''}
                  {fmt(point.x, decimalsOf([point.x]))} · {fmt(point.y)}
                  {unit}
                </span>
              </Box>
            ) : null;
          }}
        />
        {chart.series.map((s, index) => (
          <Scatter
            key={s.name}
            name={s.name}
            data={(s.points ?? []).map(([x, y]) => ({ x, y, s: s.name }))}
            fill={colorOf(index)}
            {...RING}
            animationDuration={400}
          />
        ))}
      </ScatterChart>
    );
  } else if (type === 'bars') {
    plot = chart.horizontal ? (
      <BarChart data={rows} layout="vertical" barCategoryGap="24%" barGap={2} margin={margin}>
        {grid}
        <XAxis
          type="number"
          tickLine={false}
          axisLine={false}
          tickMargin={8}
          tick={AXIS_TICK}
          tickFormatter={tick}
        />
        <YAxis
          type="category"
          dataKey="category"
          width={112}
          tickLine={false}
          axisLine={false}
          tick={AXIS_TICK}
        />
        {reference}
        {categoryTooltip}
        {chart.series.map((s, index) => (
          <Bar
            key={s.name}
            dataKey={key(index)}
            name={s.name}
            stackId={chart.stacked ? 'stack' : undefined}
            fill={colorOf(index)}
            {...(chart.stacked ? RING : {})}
            maxBarSize={24}
            radius={chart.stacked ? 0 : [0, 4, 4, 0]}
            animationDuration={400}
          />
        ))}
      </BarChart>
    ) : (
      <BarChart data={rows} barCategoryGap="24%" barGap={2} margin={margin}>
        {grid}
        {categoryAxis}
        {valueAxis}
        {reference}
        {categoryTooltip}
        {chart.series.map((s, index) => (
          <Bar
            key={s.name}
            dataKey={key(index)}
            name={s.name}
            stackId={chart.stacked ? 'stack' : undefined}
            fill={colorOf(index)}
            // A surface-colored gap, not a border, separates stacked segments.
            {...(chart.stacked ? RING : {})}
            maxBarSize={24}
            radius={chart.stacked ? 0 : [4, 4, 0, 0]}
            animationDuration={400}
          />
        ))}
      </BarChart>
    );
  } else if (type === 'area') {
    plot = (
      <AreaChart data={rows} margin={margin}>
        {grid}
        {categoryAxis}
        {valueAxis}
        {reference}
        {categoryTooltip}
        {chart.series.map((s, index) => (
          <Area
            key={s.name}
            dataKey={key(index)}
            name={s.name}
            type="monotone"
            stackId={chart.stacked ? 'stack' : undefined}
            stroke={colorOf(index)}
            strokeWidth={2}
            fill={colorOf(index)}
            // A wash under the line; stacked areas need more ink to read as bands.
            fillOpacity={chart.stacked ? 0.35 : 0.1}
            connectNulls
            animationDuration={400}
          />
        ))}
      </AreaChart>
    );
  } else {
    plot = (
      <LineChart data={rows} margin={margin}>
        {grid}
        {categoryAxis}
        {valueAxis}
        {reference}
        {categoryTooltip}
        {chart.series.map((s, index) => (
          <Line
            key={s.name}
            dataKey={key(index)}
            name={s.name}
            type="monotone"
            stroke={colorOf(index)}
            strokeWidth={2}
            strokeLinecap="round"
            strokeLinejoin="round"
            connectNulls
            dot={rows.length <= 12 ? { r: 4, fill: colorOf(index), ...RING } : false}
            activeDot={{ r: 4, ...RING }}
            animationDuration={400}
          />
        ))}
      </LineChart>
    );
  }

  const donut = type === 'donut';
  return (
    <section
      aria-label={chart.title}
      data-testid="orion-chart"
      data-chart-type={type}
      className={`bg-card flex w-full min-w-0 flex-col overflow-hidden rounded-xl border ${donut ? 'max-w-xl' : ''}`}
    >
      <header className="flex h-9 shrink-0 items-center gap-2 pr-1.5 pl-3">
        <h3 className="min-w-0 flex-1 truncate text-xs font-medium">{chart.title}</h3>
        <Button
          variant="ghost"
          size="icon-xs"
          aria-label={t.panelCsv}
          title={t.panelCsv}
          onClick={csv}
        >
          <Download />
        </Button>
      </header>
      <div
        className={
          donut
            ? 'flex h-56 min-h-0 min-w-0 items-center gap-4 px-3 pb-3'
            : 'flex h-72 min-h-0 min-w-0 flex-col gap-2 px-3 pb-3 lg:h-80'
        }
      >
        {donut ? null : (
          <div className="flex shrink-0 items-start justify-between gap-3">
            {count > 1 ? (
              <ul className="flex min-w-0 flex-wrap gap-x-3 gap-y-1">
                {legend.map((item) => (
                  <li
                    key={item.name}
                    className="text-muted-foreground text-2xs flex min-w-0 items-center gap-1.5"
                  >
                    <LegendKey color={item.color} kind={mark} />
                    <span className="truncate">{item.name}</span>
                  </li>
                ))}
              </ul>
            ) : (
              <span />
            )}
            <span className="text-tertiary text-2xs shrink-0">
              {[chart.xLabel && type === 'scatter' ? `${chart.xLabel} →` : '', chart.unit ?? '']
                .filter(Boolean)
                .join(' · ')}
            </span>
          </div>
        )}
        <div className={donut ? 'relative h-full w-1/2 min-w-0' : 'relative min-h-0 flex-1'}>
          <ChartContainer
            config={config}
            className="absolute inset-0 aspect-auto h-full w-full"
            role="img"
            aria-label={summary}
          >
            {plot}
          </ChartContainer>
        </div>
        {donut ? (
          // The slices are named and valued here, so identity never rests on color alone.
          <ul className="flex min-w-0 flex-1 flex-col gap-1.5">
            {legend.map((item) => (
              <li key={item.name} className="flex min-w-0 items-center gap-2 text-xs">
                <LegendKey color={item.color} kind="bar" />
                <span className="truncate">{item.name}</span>
                <span className="text-muted-foreground ml-auto shrink-0 tabular-nums">
                  {item.value}
                </span>
              </li>
            ))}
          </ul>
        ) : null}
      </div>
    </section>
  );
}
