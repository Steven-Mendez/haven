'use client';

import { useEffect, useId, useState } from 'react';
import {
  Area,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ComposedChart,
  ReferenceArea,
  ReferenceLine,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { type ChartConfig, ChartContainer } from '@/components/ui/chart';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { TooltipContent, TooltipTrigger, Tooltip as UiTooltip } from '@/components/ui/tooltip';
import { format, formatClock, formatDate, formatNumber, type Language } from '@/lib/i18n';
import { cn } from '@/lib/utils';
import { type TermExplanation, TermTip } from './term-tip';
import { havenTexts } from './texts';
import type { SeriesPoint, VisualLevel } from './types';

export type ChartMarker = { at: string | number; label: string };
export type ChartRange = '1d' | '7d' | '4w';

type Props = {
  points: SeriesPoint[];
  lang: Language;
  title?: string;
  unit?: string;
  baseline?: { median: number; range: [number, number] };
  normalRange?: [number, number];
  level?: VisualLevel;
  markers?: ChartMarker[];
  decimals?: number;
  height?: number;
  nowAt?: number;
  nowLabel?: string;
  header?: 'full' | 'controls' | 'none';
  showHeader?: boolean;
  kind?: 'line' | 'bar';
  titleExplain?: TermExplanation;
  glossary?: { baseline?: TermExplanation; reference?: TermExplanation; now?: TermExplanation };
  className?: string;
};

const toMs = (v: string | number) => (typeof v === 'number' ? v : Date.parse(v));
const HOUR = 3_600_000;
const DAY = 24 * HOUR;
const WINDOW: Record<ChartRange, number> = { '1d': DAY, '7d': 7 * DAY, '4w': 28 * DAY };
const RANGES: ChartRange[] = ['1d', '7d', '4w'];

type Datum = { at: number; value: number };

function niceTicks(lo: number, hi: number): number[] {
  const span = hi - lo || Math.abs(hi) || 1;
  const raw = span / 2;
  const mag = 10 ** Math.floor(Math.log10(raw));
  const step = [1, 2, 2.5, 5, 10].map((m) => m * mag).find((s) => s >= raw) ?? raw;
  const start = Math.floor(lo / step) * step;
  const ticks = [start, start + step, start + 2 * step];
  while ((ticks[2] ?? 0) < hi) {
    ticks.push((ticks.at(-1) ?? 0) + step);
    ticks.shift();
  }
  return ticks;
}

function defaultRange(data: Datum[], end: number): ChartRange {
  const inWindow = (r: ChartRange) => data.filter((d) => d.at >= end - WINDOW[r]).length;
  return inWindow('7d') >= 4 ? '7d' : '4w';
}

function useAnimateOnce() {
  const [animate, setAnimate] = useState(true);
  useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) setAnimate(false);
  }, []);
  return [animate, () => setAnimate(false)] as const;
}

function ChartTooltip({
  active,
  payload,
  unit,
  fmt,
  lang,
  daily,
}: {
  active?: boolean;
  payload?: readonly { payload?: Datum }[];
  unit?: string;
  fmt: (v: number) => string;
  lang: Language;
  daily?: boolean;
}) {
  const d = payload?.[0]?.payload;
  if (!active || !d) return null;
  return (
    <div className="bg-popover border-border rounded-lg border px-2.5 py-2 shadow-none">
      <p className="flex items-baseline gap-1">
        <span className="text-sm font-semibold tabular-nums">{fmt(d.value)}</span>
        {unit ? <span className="text-muted-foreground text-xs">{unit}</span> : null}
      </p>
      <p className="text-tertiary text-2xs font-mono">
        {formatDate(d.at, lang)}
        {daily ? '' : ` ${formatClock(d.at, lang)}`}
      </p>
    </div>
  );
}

function EdgeTick({
  x,
  y,
  index,
  payload,
  count,
  format: label,
}: {
  x?: number;
  y?: number;
  index?: number;
  payload?: { value: number };
  count: number;
  format: (v: number) => string;
}) {
  return (
    <text
      x={x}
      y={(y ?? 0) + 12}
      fill="var(--chart-axis)"
      fontSize={11}
      className="tabular-nums"
      textAnchor={index === 0 ? 'start' : index === count - 1 ? 'end' : 'middle'}
    >
      {label(payload?.value ?? 0)}
    </text>
  );
}

const levelColor = (level?: VisualLevel) =>
  level === 'red' ? 'var(--level-red)' : 'var(--level-amber)';

export function SeriesChart({
  points,
  lang,
  title,
  unit,
  baseline,
  normalRange,
  level,
  markers,
  decimals = 0,
  height = 240,
  nowAt,
  header: headerProp,
  showHeader,
  kind = 'line',
  titleExplain,
  glossary,
  className,
}: Props) {
  const t = havenTexts[lang];
  const id = useId().replace(/:/g, '');
  const header = headerProp ?? (showHeader === false ? 'controls' : 'full');
  const [animate, done] = useAnimateOnce();

  const all: Datum[] = points
    .map(([at, value]) => ({ at: toMs(at), value }))
    .filter((d) => Number.isFinite(d.at) && Number.isFinite(d.value))
    .sort((a, b) => a.at - b.at);
  const lastAll = all.at(-1)?.at ?? 0;
  const end = nowAt !== undefined && nowAt > lastAll ? nowAt : lastAll;
  const [range, setRange] = useState<ChartRange>(() => defaultRange(all, end));
  const start = end - WINDOW[range];
  const data = all.filter((d) => d.at >= start);

  const fmt = (v: number) => formatNumber(v, lang, decimals);
  const last = data.at(-1);
  const lastAt = last?.at ?? end;
  const now = nowAt !== undefined && nowAt > lastAt ? nowAt : undefined;
  const outOf = (v: number) => (normalRange ? v < normalRange[0] || v > normalRange[1] : false);

  const values = data.map((d) => d.value);
  const extra = baseline ? [...baseline.range, baseline.median] : [];
  const lo = Math.min(...values, ...extra);
  const hi = Math.max(...values, ...extra);
  const pad = (hi - lo || Math.abs(hi) || 1) * 0.1;
  const yTicks = data.length
    ? niceTicks(kind === 'bar' ? Math.min(0, lo) : lo - pad, hi + pad)
    : [0, 1, 2];
  const yDomain: [number, number] = [yTicks[0] ?? 0, yTicks.at(-1) ?? 1];
  const xTicks = [start, start + (end - start) / 2, end];
  const tickLabel = (v: number) => (range === '1d' ? formatClock(v, lang) : formatDate(v, lang));

  const delta =
    last && baseline
      ? { value: last.value - baseline.median, text: t.chartVsBase }
      : last && data[0] && data.length > 1
        ? { value: last.value - data[0].value, text: t.chartVsStart }
        : null;
  const deltaText = delta
    ? format(delta.text, {
        d: `${delta.value > 0 ? '+' : delta.value < 0 ? '−' : '±'}${fmt(Math.abs(delta.value))}`,
      })
    : null;

  const config = {
    value: { label: title ?? '', color: 'var(--chart-line)' },
  } satisfies ChartConfig;
  const summary = [
    title,
    last ? `${fmt(last.value)}${unit ? ` ${unit}` : ''}` : t.noSeries,
    baseline ? `${t.baseline}: ${fmt(baseline.range[0])}–${fmt(baseline.range[1])}` : null,
    normalRange ? `${t.normalRange}: ${fmt(normalRange[0])}–${fmt(normalRange[1])}` : null,
  ]
    .filter(Boolean)
    .join('. ');

  const control = (
    <ToggleGroup
      value={[range]}
      onValueChange={(v) => {
        const next = v[0] as ChartRange | undefined;
        if (next) setRange(next);
      }}
      spacing={0}
      aria-label={t.chartPeriod}
      className="h-7 rounded-md border p-0.5"
    >
      {RANGES.map((r) => (
        <UiTooltip key={r}>
          <TooltipTrigger
            render={
              <ToggleGroupItem
                value={r}
                size="sm"
                aria-label={t[`range${r}Hint` as const]}
                className="text-muted-foreground data-pressed:bg-active data-pressed:text-foreground h-6 min-w-8 rounded-sm! px-2 text-xs tabular-nums"
              />
            }
          >
            {t[`chartRange${r}` as const]}
          </TooltipTrigger>
          <TooltipContent>{t[`range${r}Hint` as const]}</TooltipContent>
        </UiTooltip>
      ))}
    </ToggleGroup>
  );

  const bars =
    kind === 'bar'
      ? Object.values(
          data.reduce<Record<string, { at: number; sum: number; n: number }>>((acc, d) => {
            const key = new Date(d.at).toISOString().slice(0, 10);
            const b = acc[key] ?? { at: Date.parse(`${key}T12:00:00Z`), sum: 0, n: 0 };
            b.sum += d.value;
            b.n += 1;
            acc[key] = b;
            return acc;
          }, {}),
        ).map((b) => ({ at: b.at, value: b.sum / b.n }))
      : [];
  const [hoverBar, setHoverBar] = useState<number | null>(null);

  const axisY = (
    <YAxis
      orientation="right"
      width={40}
      ticks={yTicks}
      domain={yDomain}
      tickLine={false}
      axisLine={false}
      tickMargin={8}
      tick={{ fill: 'var(--chart-axis)', fontSize: 11 }}
      tickFormatter={(v: number) => fmt(v)}
    />
  );
  const grid = <CartesianGrid vertical={false} stroke="var(--chart-grid)" strokeWidth={1} />;

  return (
    <figure className={cn('flex flex-col gap-3', className)}>
      {header !== 'none' ? (
        <figcaption className="flex flex-wrap items-start justify-between gap-3">
          {header === 'full' ? (
            <div className="flex min-w-0 flex-col gap-1">
              {title ? (
                <span className="text-muted-foreground text-xs">
                  <TermTip explanation={titleExplain}>{title}</TermTip>
                </span>
              ) : null}
              {last ? (
                <span className="flex flex-wrap items-baseline gap-x-1.5 gap-y-1">
                  <span className="text-metric font-medium tracking-[-0.02em] tabular-nums">
                    {fmt(last.value)}
                  </span>
                  {unit ? <span className="text-muted-foreground text-sm">{unit}</span> : null}
                  {deltaText ? (
                    <span className="bg-muted text-muted-foreground ml-1 inline-flex h-5 items-center rounded-md px-1.5 text-xs tabular-nums">
                      {deltaText}
                    </span>
                  ) : null}
                </span>
              ) : (
                <span className="text-muted-foreground text-sm">{t.noSeries}</span>
              )}
              {last ? (
                <span className="text-tertiary text-2xs font-mono">
                  {formatDate(last.at, lang)} {formatClock(last.at, lang)} UTC
                </span>
              ) : null}
            </div>
          ) : (
            <span className="text-tertiary text-2xs self-center font-mono">
              {last ? `${formatDate(last.at, lang)} ${formatClock(last.at, lang)} UTC` : ''}
              {title ? <span className="sr-only"> · {title}</span> : null}
            </span>
          )}
          <div className="flex items-center gap-3">
            {normalRange ? (
              <span className="text-tertiary text-2xs hidden tabular-nums sm:inline">
                <TermTip explanation={glossary?.reference}>
                  {format(t.chartReference, { min: fmt(normalRange[0]), max: fmt(normalRange[1]) })}
                  {unit ? ` ${unit}` : ''}
                </TermTip>
              </span>
            ) : null}
            {control}
          </div>
        </figcaption>
      ) : null}

      {(kind === 'bar' ? bars.length : data.length) === 0 ? (
        <div className="text-muted-foreground grid place-items-center text-xs" style={{ height }}>
          {t.chartNoPeriod}
        </div>
      ) : (
        <ChartContainer
          config={config}
          className="aspect-auto w-full"
          style={{ height }}
          role="img"
          aria-label={summary}
        >
          {kind === 'bar' ? (
            <BarChart
              data={bars}
              barCategoryGap="40%"
              margin={{ top: 8, right: 0, bottom: 0, left: 0 }}
              onMouseMove={(s) => {
                const i = Number(s?.activeTooltipIndex);
                setHoverBar(Number.isFinite(i) ? i : null);
              }}
              onMouseLeave={() => setHoverBar(null)}
            >
              {grid}
              <XAxis
                dataKey="at"
                tickLine={false}
                axisLine={false}
                tickMargin={8}
                interval="preserveStartEnd"
                minTickGap={48}
                tick={{ fill: 'var(--chart-axis)', fontSize: 11 }}
                tickFormatter={(v: number) => formatDate(v, lang)}
              />
              {axisY}
              {baseline ? (
                <ReferenceLine
                  y={baseline.median}
                  stroke="var(--chart-baseline)"
                  strokeDasharray="3 3"
                  label={{
                    value: format(t.chartBase, { v: fmt(baseline.median) }),
                    position: 'insideTopRight',
                    fill: 'var(--chart-axis)',
                    fontSize: 11,
                  }}
                />
              ) : null}
              <Tooltip
                cursor={false}
                isAnimationActive={false}
                content={(p) => (
                  <ChartTooltip
                    active={p.active}
                    payload={p.payload as readonly { payload?: Datum }[]}
                    unit={unit}
                    fmt={fmt}
                    lang={lang}
                    daily
                  />
                )}
              />
              <Bar
                dataKey="value"
                radius={[2, 2, 0, 0]}
                isAnimationActive={animate}
                animationDuration={400}
                animationEasing="ease-out"
                onAnimationEnd={done}
              >
                {bars.map((b, i) => (
                  <Cell
                    key={b.at}
                    fill={
                      i === (hoverBar ?? bars.length - 1) ? 'var(--chart-line)' : 'var(--chart-bar)'
                    }
                  />
                ))}
              </Bar>
            </BarChart>
          ) : (
            <ComposedChart data={data} margin={{ top: 16, right: 0, bottom: 0, left: 0 }}>
              <defs>
                <linearGradient id={`area-${id}`} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="var(--chart-line)" stopOpacity={0.08} />
                  <stop offset="100%" stopColor="var(--chart-line)" stopOpacity={0} />
                </linearGradient>
                <pattern
                  id={`hatch-${id}`}
                  width="6"
                  height="6"
                  patternUnits="userSpaceOnUse"
                  patternTransform="rotate(45)"
                >
                  <line x1="0" y1="0" x2="0" y2="6" stroke="var(--chart-hatch)" strokeWidth={2} />
                </pattern>
              </defs>
              {grid}
              <XAxis
                dataKey="at"
                type="number"
                scale="time"
                domain={[start, end]}
                ticks={xTicks}
                interval={0}
                tickLine={false}
                axisLine={false}
                tick={<EdgeTick count={xTicks.length} format={tickLabel} />}
              />
              {axisY}
              {baseline ? (
                <ReferenceArea
                  y1={baseline.range[0]}
                  y2={baseline.range[1]}
                  fill="var(--chart-band)"
                  fillOpacity={1}
                  strokeOpacity={0}
                  ifOverflow="hidden"
                />
              ) : null}
              {baseline ? (
                <ReferenceLine
                  y={baseline.median}
                  stroke="var(--chart-baseline)"
                  strokeDasharray="3 3"
                  label={{
                    value: format(t.chartBase, { v: fmt(baseline.median) }),
                    position: 'insideBottomRight',
                    fill: 'var(--chart-axis)',
                    fontSize: 11,
                  }}
                />
              ) : null}
              {markers
                ?.filter((m) => toMs(m.at) >= start && toMs(m.at) <= end)
                .map((m) => (
                  <ReferenceLine
                    key={`${m.at}-${m.label}`}
                    x={toMs(m.at)}
                    stroke="var(--chart-baseline)"
                    strokeDasharray="3 3"
                    label={{
                      value: m.label,
                      position: 'insideTopLeft',
                      fill: 'var(--chart-axis)',
                      fontSize: 11,
                    }}
                  />
                ))}
              {now ? (
                <>
                  <ReferenceArea
                    x1={lastAt}
                    x2={now}
                    fill={`url(#hatch-${id})`}
                    fillOpacity={1}
                    strokeOpacity={0}
                  />
                  <ReferenceLine
                    x={now}
                    stroke="var(--chart-baseline)"
                    strokeDasharray="3 3"
                    label={{
                      value: t.chartNowEarth,
                      position: 'insideTopRight',
                      fill: 'var(--chart-axis)',
                      fontSize: 11,
                      dy: -14,
                      dx: -4,
                    }}
                  />
                </>
              ) : null}
              <Tooltip
                cursor={{ stroke: 'var(--chart-crosshair)', strokeWidth: 1 }}
                isAnimationActive={false}
                wrapperStyle={{ outline: 'none' }}
                content={(p) => (
                  <ChartTooltip
                    active={p.active}
                    payload={p.payload as readonly { payload?: Datum }[]}
                    unit={unit}
                    fmt={fmt}
                    lang={lang}
                  />
                )}
              />
              <Area
                dataKey="value"
                type="monotone"
                fill={`url(#area-${id})`}
                stroke="var(--color-value)"
                strokeWidth={1.5}
                strokeLinejoin="round"
                strokeLinecap="round"
                isAnimationActive={animate}
                animationDuration={400}
                animationEasing="ease-out"
                onAnimationEnd={done}
                dot={(p: { cx?: number; cy?: number; index?: number; value?: unknown }) => {
                  const v = data[p.index ?? -1]?.value;
                  const isLast = p.index === data.length - 1;
                  const out = v !== undefined && outOf(v);
                  if (p.cx === undefined || p.cy === undefined || (!isLast && !out))
                    return <g key={`d${p.index}`} />;
                  const color = out ? levelColor(level) : 'var(--chart-line)';
                  return isLast ? (
                    <g key="last">
                      <circle cx={p.cx} cy={p.cy} r={5} fill={color} fillOpacity={0.15} />
                      <circle cx={p.cx} cy={p.cy} r={2} fill={color} />
                    </g>
                  ) : (
                    <circle key={`o${p.index}`} cx={p.cx} cy={p.cy} r={1.5} fill={color} />
                  );
                }}
                activeDot={{
                  r: 3,
                  fill: 'var(--chart-line)',
                  stroke: 'var(--background)',
                  strokeWidth: 2,
                }}
              />
            </ComposedChart>
          )}
        </ChartContainer>
      )}
    </figure>
  );
}
