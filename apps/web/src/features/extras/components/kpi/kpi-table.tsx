'use client';

import { Sparkline } from '@/components/haven/sparkline';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { inRange, seriesStats, showsReference } from '../../logic/kpi';
import { RangeStatus } from './kpi-status';
import { fmt, type KpiEnv, type ResolvedPanel } from './model';

export function KpiTable({ model, env }: { model: ResolvedPanel; env: KpiEnv }) {
  const { t } = env;
  const showStatus = showsReference(model.panel) && model.series.some((s) => s.info?.green);
  return (
    <div className="@container h-full min-h-0 overflow-auto">
      <Table className="text-xs tabular-nums">
        <TableHeader>
          <TableRow>
            <TableHead className="h-8 pl-0">{t.kpiColSeries}</TableHead>
            <TableHead className="h-8">{t.kpiColUnit}</TableHead>
            <TableHead className="h-8 text-right">{t.kpiColLast}</TableHead>
            <TableHead className="hidden h-8 text-right @2xl:table-cell">{t.kpiColMin}</TableHead>
            <TableHead className="hidden h-8 text-right @2xl:table-cell">{t.kpiColMax}</TableHead>
            <TableHead className="h-8 text-right">{t.kpiColMean}</TableHead>
            <TableHead className="hidden h-8 @xl:table-cell">
              <span className="sr-only">{t.kpiColTrend}</span>
            </TableHead>
            {showStatus ? <TableHead className="h-8 pr-0">{t.kpiColStatus}</TableHead> : null}
          </TableRow>
        </TableHeader>
        <TableBody>
          {model.series.map((s) => {
            const stats = seriesStats(s.points);
            const inside = stats && s.info?.green ? inRange(stats.last.mean, s.info.green) : null;
            return (
              <TableRow key={s.key}>
                <TableCell className="max-w-48 truncate pl-0 font-medium" title={s.name}>
                  {s.name}
                </TableCell>
                <TableCell className="text-muted-foreground">{s.unit}</TableCell>
                {stats ? (
                  <>
                    <TableCell className="text-right">
                      {fmt(env, stats.last.mean, s.decimals)}
                    </TableCell>
                    <TableCell className="text-muted-foreground hidden text-right @2xl:table-cell">
                      {fmt(env, stats.min, s.decimals)}
                    </TableCell>
                    <TableCell className="text-muted-foreground hidden text-right @2xl:table-cell">
                      {fmt(env, stats.max, s.decimals)}
                    </TableCell>
                    <TableCell className="text-muted-foreground text-right">
                      {fmt(env, stats.mean, s.decimals)}
                    </TableCell>
                    <TableCell className="hidden @xl:table-cell">
                      <Sparkline
                        points={s.points.map((p) => [p.date, p.mean])}
                        level={inside === false ? 'amber' : undefined}
                      />
                    </TableCell>
                    {showStatus ? (
                      <TableCell className="pr-0">
                        {inside === null ? (
                          <span className="text-tertiary">—</span>
                        ) : (
                          <RangeStatus inside={inside} t={t} />
                        )}
                      </TableCell>
                    ) : null}
                  </>
                ) : (
                  <TableCell colSpan={showStatus ? 6 : 5} className="text-muted-foreground pr-0">
                    {t.noGroupStat}
                  </TableCell>
                )}
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}
