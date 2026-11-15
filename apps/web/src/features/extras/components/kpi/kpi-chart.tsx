'use client';

import { useEffect, useId, useState } from 'react';
import {
  Area,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ComposedChart,
  Line,
  ReferenceArea,
  ReferenceLine,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { type ChartConfig, ChartContainer } from '@/components/ui/chart';
import { format, formatDate } from '@/lib/i18n';
import { addDays, dayMs, daysBetween, niceScale, tickDecimals, valueExtent } from '../../logic/kpi';
import { fmt, type KpiEnv, type ResolvedPanel, type ResolvedSeries } from './model';
import { rangeLong } from './texts';

type Row = { at: number; date: string } & Record<string, number | string | null>;

function useAnimateOnce() {
  const [animate, setAnimate] = useState(true);
  useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) setAnimate(false);
  }, []);
  return [animate, () => setAnimate(false)] as const;
}

const dataKey = (index: number) => `s${index}`;

const AXIS_MIN_WIDTH = 44;
const AXIS_TICK_MARGIN = 8;
/** Recharts' default tick size: labels start this far past the margin even without tick lines. */
const AXIS_TICK_SIZE = 6;
/** Approximate advance of an 11px tabular figure; separators and signs are narrower. */
const AXIS_CHAR_PX = 7;

/** Width of the right-hand y axis: fits the longest formatted tick, never below today's 44px. */
function axisWidth(labels: string[]): number {
  const longest = Math.max(0, ...labels.map((l) => l.length));
  return Math.max(
    AXIS_MIN_WIDTH,
    Math.ceil(longest * AXIS_CHAR_PX + AXIS_TICK_MARGIN + AXIS_TICK_SIZE + 2),
  );
}

function rowsFor(series: ResolvedSeries[], days: string[]): Row[] {
  const byDay = series.map((s) => new Map(s.points.map((p) => [p.date, p.mean])));
  return days.map((date) => {
    const row: Row = { at: dayMs(date), date };
    byDay.forEach((m, index) => {
      row[dataKey(index)] = m.get(date) ?? null;
    });
    return row;
  });
}

export function LegendKey({ color, kind }: { color: string; kind: 'line' | 'bar' }) {
  return kind === 'line' ? (
    <span
      aria-hidden="true"
      className="h-0.5 w-3 shrink-0 rounded-full"
      style={{ background: color }}
    />
  ) : (
    <span
      aria-hidden="true"
      className="size-2 shrink-0 rounded-[2px]"
      style={{ background: color }}
    />
  );
}

function ChartTooltipBox({
  row,
  series,
  env,
  kind,
}: {
  row?: Row;
  series: ResolvedSeries[];
  env: KpiEnv;
  kind: 'line' | 'bar';
}) {
  if (!row) return null;
  const single = series.length === 1;
  return (
    <div className="bg-popover border-border min-w-32 rounded-lg border px-2.5 py-2 shadow-none">
      <ul className="flex flex-col gap-1">
        {series.map((s, index) => {
          const value = row[dataKey(index)];
          return (
            <li key={s.key} className="flex items-center gap-2">
              {single ? null : <LegendKey color={s.color} kind={kind} />}
              <span className="flex min-w-0 items-baseline gap-1">
                {typeof value === 'number' ? (
                  <>
                    <span className="text-sm font-semibold tabular-nums">
                      {fmt(env, value, s.decimals)}
                    </span>
                    {s.unit ? (
                      <span className="text-muted-foreground text-xs">{s.unit}</span>
                    ) : null}
                  </>
                ) : (
                  <span className="text-muted-foreground text-xs">{env.t.noGroupStat}</span>
                )}
                {single ? null : (
                  <span className="text-muted-foreground truncate text-xs">{s.label}</span>
                )}
              </span>
            </li>
          );
        })}
      </ul>
      <p className="text-tertiary text-2xs mt-1 font-mono">{formatDate(row.at, env.lang)}</p>
    </div>
  );
}

function EdgeTick({
  x,
  y,
  index,
  payload,
  count,
  label,
}: {
  x?: number;
  y?: number;
  index?: number;
  payload?: { value: number };
  count: number;
  label: (v: number) => string;
}) {
  return (
    <text
      x={x}
      y={(y ?? 0) + 12}
      fill="var(--chart-axis)"
      fontSize={11}
      className="tabular-nums"
      textAnchor={
        count === 1 ? 'middle' : index === 0 ? 'start' : index === count - 1 ? 'end' : 'middle'
      }
    >
      {label(payload?.value ?? 0)}
    </text>
  );
}

export function KpiChart({ model, env }: { model: ResolvedPanel; env: KpiEnv }) {
  const id = useId().replace(/:/g, '');
  const [animate, done] = useAnimateOnce();
  const [hover, setHover] = useState<number | null>(null);
  const { panel, series, span, reference } = model;
  const kind = panel.type === 'bars' ? 'bar' : 'line';
  if (!span) return null;

  const days = daysBetween(span[0], span[1]);
  const all = rowsFor(series, days);
  const rows =
    kind === 'line'
      ? all.filter((r) => series.some((_, index) => typeof r[dataKey(index)] === 'number'))
      : all;

  const values = series.flatMap((s) => s.points.map((p) => p.mean));
  const [lo, hi] = valueExtent(values, reference);
  const pad = kind === 'line' ? (hi - lo || Math.abs(hi) || 1) * 0.08 : 0;
  const scale = niceScale(lo - pad, hi + pad, { zero: kind === 'bar' });
  const yDecimals = tickDecimals(scale.ticks);
  const yLabels = scale.ticks.map((v) => fmt(env, v, yDecimals));
  const yWidth = axisWidth(yLabels);

  const from = dayMs(span[0]);
  const to = dayMs(span[1]);
  const xDomain: [number, number] = from === to ? [from - 43_200_000, to + 43_200_000] : [from, to];
  const mid = days.length > 2 ? dayMs(addDays(span[0], Math.floor((days.length - 1) / 2))) : null;
  const xTicks = from === to ? [from] : mid ? [from, mid, to] : [from, to];
  const markers = panel.type === 'timeseries' && panel.markers === true ? env.markers : [];
  const visibleMarkers = markers
    .map((m) => ({ ...m, x: Date.parse(m.at) }))
    .filter((m) => Number.isFinite(m.x) && m.x >= xDomain[0] && m.x <= xDomain[1] + 86_400_000);

  const config = Object.fromEntries(
    series.map((s, index) => [dataKey(index), { label: s.label, color: s.color }]),
  ) satisfies ChartConfig;

  const summary = format(env.t.kpiChartSummary, {
    title: model.title,
    period: `${rangeLong(env.t, model.range)} (${formatDate(from, env.lang)}–${formatDate(to, env.lang)})`,
    values: series
      .map((s) => {
        const last = s.points.at(-1);
        return last
          ? format(env.t.kpiSummaryValue, {
              name: s.name,
              value: fmt(env, last.mean, s.decimals),
              unit: s.unit,
            })
          : `${s.name}: ${env.t.noGroupStat}`;
      })
      .join('; '),
  });

  const grid = <CartesianGrid vertical={false} stroke="var(--chart-grid)" strokeWidth={1} />;
  const yAxis = (
    <YAxis
      orientation="right"
      width={yWidth}
      ticks={scale.ticks}
      domain={scale.domain}
      allowDataOverflow
      tickLine={false}
      axisLine={false}
      tickMargin={8}
      tick={{ fill: 'var(--chart-axis)', fontSize: 11 }}
      tickFormatter={(v: number) => fmt(env, v, yDecimals)}
    />
  );
  const band = reference ? (
    <ReferenceArea
      y1={reference[0]}
      y2={reference[1]}
      fill="var(--chart-band)"
      fillOpacity={1}
      strokeOpacity={0}
      ifOverflow="hidden"
    />
  ) : null;
  const single = series.length === 1;
  const unit = [...new Set(series.map((s) => s.unit).filter(Boolean))].join(' · ');

  return (
    <div className="flex h-full min-h-0 min-w-0 flex-col gap-2">
      {single && !unit ? null : (
        <div className="flex shrink-0 items-start justify-between gap-3">
          {single ? (
            <span />
          ) : (
            <ul aria-label={env.t.kpiLegend} className="flex min-w-0 flex-wrap gap-x-3 gap-y-1">
              {series.map((s) => (
                <li
                  key={s.key}
                  className="text-muted-foreground text-2xs flex min-w-0 items-center gap-1.5"
                >
                  <LegendKey
                    color={s.points.length ? s.color : 'var(--chart-reference)'}
                    kind={kind}
                  />
                  <span className="truncate">{s.label}</span>
                  {s.points.length ? null : (
                    <span className="text-tertiary shrink-0">· {env.t.noGroupStat}</span>
                  )}
                </li>
              ))}
            </ul>
          )}
          {unit ? (
            // Starts where the tick labels start, so it reads as the axis title.
            <span
              className="text-tertiary text-2xs shrink-0 text-left"
              style={{ minWidth: yWidth - AXIS_TICK_MARGIN - AXIS_TICK_SIZE }}
            >
              {unit}
            </span>
          ) : null}
        </div>
      )}
      <div className="relative min-h-0 flex-1">
        <ChartContainer
          config={config}
          className="absolute inset-0 aspect-auto h-full w-full"
          role="img"
          aria-label={summary}
        >
          {kind === 'bar' ? (
            <BarChart
              data={rows}
              barCategoryGap="20%"
              barGap={2}
              margin={{ top: 4, right: 0, bottom: 0, left: 0 }}
              onMouseMove={(s) => {
                const i = Number(s?.activeTooltipIndex);
                setHover(Number.isFinite(i) ? i : null);
              }}
              onMouseLeave={() => setHover(null)}
            >
              {grid}
              <XAxis
                dataKey="date"
                tickLine={false}
                axisLine={false}
                tickMargin={8}
                interval="preserveStartEnd"
                minTickGap={40}
                tick={{ fill: 'var(--chart-axis)', fontSize: 11 }}
                tickFormatter={(d: string) => formatDate(dayMs(d), env.lang)}
              />
              {yAxis}
              {band}
              <Tooltip
                cursor={false}
                isAnimationActive={false}
                wrapperStyle={{ outline: 'none' }}
                content={(p) => (
                  <ChartTooltipBox
                    row={p.active ? (p.payload?.[0]?.payload as Row | undefined) : undefined}
                    series={series}
                    env={env}
                    kind="bar"
                  />
                )}
              />
              {series.map((s, index) => (
                <Bar
                  key={s.key}
                  dataKey={dataKey(index)}
                  name={s.label}
                  fill={single ? 'var(--chart-bar)' : s.color}
                  maxBarSize={24}
                  radius={[4, 4, 0, 0]}
                  isAnimationActive={animate}
                  animationDuration={400}
                  animationEasing="ease-out"
                  onAnimationEnd={done}
                >
                  {single
                    ? rows.map((r, i) => (
                        <Cell
                          key={r.date}
                          fill={
                            i === (hover ?? rows.length - 1)
                              ? 'var(--chart-line)'
                              : 'var(--chart-bar)'
                          }
                        />
                      ))
                    : null}
                </Bar>
              ))}
            </BarChart>
          ) : (
            <ComposedChart data={rows} margin={{ top: 8, right: 0, bottom: 0, left: 0 }}>
              <defs>
                <linearGradient id={`kpi-area-${id}`} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="var(--chart-line)" stopOpacity={0.1} />
                  <stop offset="100%" stopColor="var(--chart-line)" stopOpacity={0} />
                </linearGradient>
              </defs>
              {grid}
              <XAxis
                dataKey="at"
                type="number"
                scale="time"
                domain={xDomain}
                ticks={xTicks}
                interval={0}
                tickLine={false}
                axisLine={false}
                tick={<EdgeTick count={xTicks.length} label={(v) => formatDate(v, env.lang)} />}
              />
              {yAxis}
              {band}
              {visibleMarkers.map((m) => (
                <ReferenceLine
                  key={`${m.at}-${m.label}`}
                  x={m.x}
                  stroke="var(--chart-baseline)"
                  strokeDasharray="3 3"
                  ifOverflow="hidden"
                  label={{
                    value: m.label,
                    position: 'insideTopLeft',
                    fill: 'var(--chart-axis)',
                    fontSize: 11,
                  }}
                />
              ))}
              <Tooltip
                cursor={{ stroke: 'var(--chart-crosshair)', strokeWidth: 1 }}
                isAnimationActive={false}
                wrapperStyle={{ outline: 'none' }}
                content={(p) => (
                  <ChartTooltipBox
                    row={p.active ? (p.payload?.[0]?.payload as Row | undefined) : undefined}
                    series={series}
                    env={env}
                    kind="line"
                  />
                )}
              />
              {series.map((s, index) =>
                single ? (
                  <Area
                    key={s.key}
                    dataKey={dataKey(index)}
                    name={s.label}
                    type="monotone"
                    connectNulls
                    fill={`url(#kpi-area-${id})`}
                    stroke="var(--chart-line)"
                    strokeWidth={2}
                    strokeLinejoin="round"
                    strokeLinecap="round"
                    dot={
                      rows.length === 1
                        ? { r: 3, fill: 'var(--chart-line)', strokeWidth: 0 }
                        : false
                    }
                    activeDot={{
                      r: 3,
                      fill: 'var(--chart-line)',
                      stroke: 'var(--card)',
                      strokeWidth: 2,
                    }}
                    isAnimationActive={animate}
                    animationDuration={400}
                    animationEasing="ease-out"
                    onAnimationEnd={done}
                  />
                ) : (
                  <Line
                    key={s.key}
                    dataKey={dataKey(index)}
                    name={s.label}
                    type="monotone"
                    connectNulls
                    stroke={s.color}
                    strokeWidth={2}
                    strokeLinejoin="round"
                    strokeLinecap="round"
                    dot={rows.length === 1 ? { r: 3, fill: s.color, strokeWidth: 0 } : false}
                    activeDot={{ r: 3, fill: s.color, stroke: 'var(--card)', strokeWidth: 2 }}
                    isAnimationActive={animate}
                    animationDuration={400}
                    animationEasing="ease-out"
                    onAnimationEnd={done}
                  />
                ),
              )}
            </ComposedChart>
          )}
        </ChartContainer>
      </div>
    </div>
  );
}
