'use client';

import { MiniTrend } from '@/components/haven/sparkline';
import { format, formatDate } from '@/lib/i18n';
import { inRange, seriesStats } from '../../logic/kpi';
import { RangeStatus } from './kpi-status';
import { fmt, type KpiEnv, PROPORTIONAL, type ResolvedPanel, signed } from './model';

export function KpiStat({ model, env }: { model: ResolvedPanel; env: KpiEnv }) {
  const s = model.series[0];
  const stats = s ? seriesStats(s.points) : null;
  if (!s || !stats) return null;
  const green = model.reference;
  const inside = green ? inRange(stats.last.mean, green) : null;
  const d = stats.count > 1 ? signed(env, stats.delta, s.decimals) : null;
  const delta = d ? format(env.t.kpiVsStart, { d }) : null;
  return (
    <div className="@container flex h-full min-h-0 flex-col gap-1.5">
      <p className="flex flex-wrap items-baseline gap-x-1.5" style={PROPORTIONAL}>
        <span className="text-metric font-medium tracking-[-0.02em]">
          {fmt(env, stats.last.mean, s.decimals)}
        </span>
        {s.unit ? <span className="text-muted-foreground text-sm">{s.unit}</span> : null}
        <span className="sr-only">
          {format(env.t.kpiLastDay, { date: formatDate(stats.last.date, env.lang) })}
        </span>
      </p>
      {delta || inside !== null ? (
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
          {delta ? (
            <span
              title={delta}
              className="bg-muted text-muted-foreground inline-flex h-5 items-center rounded-md px-1.5 text-xs tabular-nums"
            >
              {/* Narrow panels use the short wording so both chips share one line. */}
              <span className="hidden @[20rem]:inline">{delta}</span>
              <span className="@[20rem]:hidden">
                {format(env.t.kpiVsStartShort, { d: d ?? '' })}
              </span>
            </span>
          ) : null}
          {inside !== null ? <RangeStatus inside={inside} t={env.t} /> : null}
        </div>
      ) : null}
      <div className="relative min-h-6 flex-1">
        <MiniTrend
          points={s.points.map((p) => [p.date, p.mean])}
          level={inside === false ? 'amber' : undefined}
          className="absolute! inset-0 h-full!"
        />
      </div>
    </div>
  );
}
