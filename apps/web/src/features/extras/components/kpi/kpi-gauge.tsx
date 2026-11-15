'use client';

import { format } from '@/lib/i18n';
import { inRange, niceScale, seriesStats, tickDecimals } from '../../logic/kpi';
import { RangeStatus } from './kpi-status';
import { fmt, type KpiEnv, PROPORTIONAL, type ResolvedPanel } from './model';

const CX = 100;
const CY = 100;
const R = 78;
const TRACK = 12;

const clamp01 = (v: number) => Math.min(1, Math.max(0, v));

function point(f: number, r: number): [number, number] {
  const angle = Math.PI * (1 - clamp01(f));
  return [CX + r * Math.cos(angle), CY - r * Math.sin(angle)];
}

function arc(f0: number, f1: number, r: number): string {
  const [x0, y0] = point(f0, r);
  const [x1, y1] = point(f1, r);
  return `M${x0.toFixed(2)} ${y0.toFixed(2)} A${r} ${r} 0 0 1 ${x1.toFixed(2)} ${y1.toFixed(2)}`;
}

export function KpiGauge({ model, env }: { model: ResolvedPanel; env: KpiEnv }) {
  const s = model.series[0];
  const stats = s ? seriesStats(s.points) : null;
  if (!s || !stats) return null;
  const green = model.reference;
  const value = stats.last.mean;
  const scale = niceScale(
    Math.min(stats.min, ...(green ?? [])),
    Math.max(stats.max, ...(green ?? [])),
    { target: 3 },
  );
  const [min, max] = scale.domain;
  const frac = (v: number) => (v - min) / (max - min || 1);
  const inside = green ? inRange(value, green) : null;
  const color = inside === false ? 'var(--level-amber)' : 'var(--chart-line)';
  const scaleDecimals = tickDecimals([min, max]);
  const summary = format(env.t.kpiGaugeSummary, {
    title: model.title,
    value: fmt(env, value, s.decimals),
    unit: s.unit,
    min: fmt(env, min, scaleDecimals),
    max: fmt(env, max, scaleDecimals),
  });

  return (
    <div className="flex h-full min-h-0 flex-col items-center gap-1">
      <div className="relative min-h-0 w-full flex-1">
        <svg
          viewBox="0 0 200 118"
          preserveAspectRatio="xMidYMid meet"
          role="img"
          aria-label={summary}
          className="absolute inset-0 size-full"
          style={PROPORTIONAL}
        >
          <path
            d={arc(0, 1, R)}
            fill="none"
            stroke="var(--chart-bar)"
            strokeOpacity={0.35}
            strokeWidth={TRACK}
            strokeLinecap="butt"
          />
          {green ? (
            <path
              d={arc(frac(green[0]), frac(green[1]), R + TRACK / 2 + 4)}
              fill="none"
              stroke="var(--chart-baseline)"
              strokeWidth={3}
              strokeLinecap="round"
            />
          ) : null}
          <path
            d={arc(0, frac(value), R)}
            fill="none"
            stroke={color}
            strokeWidth={TRACK}
            strokeLinecap="butt"
          />
          <text
            x={CX}
            y={CY - 14}
            textAnchor="middle"
            fill="var(--foreground)"
            fontSize={28}
            fontWeight={500}
            letterSpacing="-0.02em"
          >
            {fmt(env, value, s.decimals)}
          </text>
          {s.unit ? (
            <text
              x={CX}
              y={CY + 4}
              textAnchor="middle"
              fill="var(--muted-foreground)"
              fontSize={12}
            >
              {s.unit}
            </text>
          ) : null}
          <text
            x={CX - R}
            y={CY + 16}
            textAnchor="middle"
            fill="var(--chart-axis)"
            fontSize={10}
            className="tabular-nums"
          >
            {fmt(env, min, scaleDecimals)}
          </text>
          <text
            x={CX + R}
            y={CY + 16}
            textAnchor="middle"
            fill="var(--chart-axis)"
            fontSize={10}
            className="tabular-nums"
          >
            {fmt(env, max, scaleDecimals)}
          </text>
        </svg>
      </div>
      {inside !== null && green ? (
        <div className="flex shrink-0 flex-wrap items-center justify-center gap-x-2 gap-y-0.5">
          <RangeStatus inside={inside} t={env.t} />
          <span className="text-tertiary text-2xs tabular-nums">
            {format(env.t.kpiReference, {
              min: fmt(env, green[0], tickDecimals(green)),
              max: fmt(env, green[1], tickDecimals(green)),
              unit: s.unit,
            })}
          </span>
        </div>
      ) : null}
    </div>
  );
}
