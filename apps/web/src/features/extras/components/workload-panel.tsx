import {
  dayHoursLevel,
  fatigueLevel,
  type Level,
  type WorkloadReason,
  workload,
} from '@haven/core';
import { Info } from 'lucide-react';
import { AgeLabel, EmptyState, Hint } from '@/components/haven';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { format, type Language } from '@/lib/i18n';
import type { ExtrasTexts } from '../i18n';
import type { WorkloadRow } from '../logic/workload';
import { getWorkloadOverview } from '../server';
import {
  CrewCell,
  PanelHeading,
  panelTable,
  StatusPill,
  SummaryChips,
  toneOf,
} from './panel-parts';

const LEVELS: { level: Level; label: (t: ExtrasTexts) => string }[] = [
  { level: 'green', label: (t) => t.wlGreen },
  { level: 'amber', label: (t) => t.wlAmber },
  { level: 'red', label: (t) => t.wlRed },
  { level: 'pending', label: (t) => t.wlPending },
];

const levelLabel = (level: Level, t: ExtrasTexts) =>
  LEVELS.find((l) => l.level === level)?.label(t) ?? t.wlPending;

const SCALE_COLOR: Record<string, string> = {
  amber: 'var(--scale-amber)',
  red: 'var(--scale-red)',
};

function reasonText(reason: WorkloadReason, row: WorkloadRow, t: ExtrasTexts) {
  const s = row.status;
  switch (reason) {
    case 'week-hours':
      return format(t.wlReasonWeekHours, { hours: s.weekHours });
    case 'long-streak':
      return format(t.wlReasonLongStreak, { n: s.longStreak, long: workload.day.long });
    case 'over-max':
      return format(t.wlReasonOverMax, { max: workload.day.max });
    case 'no-rest':
      return t.wlReasonNoRest;
    case 'fatigue':
      return format(t.wlReasonFatigue, { score: s.latestFatigue ?? '' });
    default:
      return t.wlReasonFatigueShortSleep;
  }
}

/** Hours of the last 7 days as one strip; long days amber, over the maximum red. */
function HoursStrip({ row, lang, t }: { row: WorkloadRow; lang: Language; t: ExtrasTexts }) {
  return (
    <ul className="bg-surface-elevated/60 inline-flex items-center divide-x rounded-md border">
      {row.days.map((d) => {
        const day = new Date(`${d.day}T12:00:00Z`).toLocaleDateString(lang, {
          weekday: 'short',
          day: 'numeric',
          timeZone: 'UTC',
        });
        const label =
          d.hours === null
            ? format(t.wlDayNone, { day })
            : d.fatigue !== null
              ? format(t.wlDayFatigue, { day, hours: d.hours, score: d.fatigue })
              : format(t.wlDay, { day, hours: d.hours });
        const color = d.hours === null ? undefined : SCALE_COLOR[dayHoursLevel(d.hours, workload)];
        return (
          <li key={d.day}>
            <Hint label={label} side="top">
              <span
                className="text-2xs flex h-7 min-w-7 items-center justify-center px-1 font-medium tabular-nums"
                style={
                  color
                    ? { background: `color-mix(in oklab, ${color} 22%, transparent)` }
                    : undefined
                }
              >
                <span aria-hidden="true" className={d.hours === null ? 'text-tertiary' : undefined}>
                  {d.hours ?? '·'}
                </span>
                <span className="sr-only">{label}</span>
              </span>
            </Hint>
          </li>
        );
      })}
    </ul>
  );
}

export async function WorkloadPanel({
  mission,
  lang,
  t,
}: {
  mission: string;
  lang: Language;
  t: ExtrasTexts;
}) {
  const data = await getWorkloadOverview(mission);
  const rows = data?.rows ?? [];
  const loaded = rows.filter((r) => r.status.level === 'amber' || r.status.level === 'red').length;

  return (
    <section aria-labelledby="workload" className="flex min-w-0 flex-col gap-3">
      <PanelHeading
        id="workload"
        title={t.workloadTitle}
        count={rows.length || undefined}
        description={t.workloadDescription}
      />
      {rows.length === 0 || !data ? (
        <EmptyState title={t.workloadEmpty} description={t.workloadEmptyDetail} />
      ) : (
        <>
          <SummaryChips
            label={t.wlStatusCol}
            items={LEVELS.map((l) => ({
              key: l.level,
              tone: toneOf(l.level),
              label: l.label(t),
              count: rows.filter((r) => r.status.level === l.level).length,
            }))}
          />
          <div className={panelTable.card}>
            <Table data-testid="workload-table">
              <TableHeader className={panelTable.header}>
                <TableRow className={panelTable.headRow}>
                  <TableHead className="pl-4">{t.astronaut}</TableHead>
                  <TableHead>{t.wlStatusCol}</TableHead>
                  <TableHead>{t.wlHoursCol}</TableHead>
                  <TableHead>{t.wlFatigueCol}</TableHead>
                  <TableHead className="hidden xl:table-cell">{t.wlSleepCol}</TableHead>
                  <TableHead className="hidden pr-4 2xl:table-cell">{t.wlReasonsCol}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((row) => {
                  const s = row.status;
                  return (
                    <TableRow key={row.id} className={panelTable.row}>
                      <TableCell className="py-3 pl-4">
                        <CrewCell
                          id={row.id}
                          name={row.name}
                          detail={
                            <AgeLabel
                              lastDataAt={row.lastDataAt}
                              now={data.generatedAt}
                              lang={lang}
                              noRecentData={row.noRecentData}
                            />
                          }
                        />
                      </TableCell>
                      <TableCell className="py-3 text-xs">
                        <span className="flex flex-col items-start gap-1">
                          <StatusPill tone={toneOf(s.level)}>{levelLabel(s.level, t)}</StatusPill>
                          {s.loggedDays > 0 ? (
                            <span className="text-muted-foreground tabular-nums">
                              {format(t.wlWeek, { hours: s.weekHours, rest: s.restDays })}
                            </span>
                          ) : null}
                        </span>
                      </TableCell>
                      <TableCell className="py-3 text-xs">
                        <span className="flex flex-col items-start gap-1">
                          <HoursStrip row={row} lang={lang} t={t} />
                          {s.longStreak >= 2 ? (
                            <span className="text-muted-foreground">
                              {format(t.wlStreak, { n: s.longStreak })}
                            </span>
                          ) : null}
                        </span>
                      </TableCell>
                      <TableCell className="py-3 text-xs">
                        {s.latestFatigue === null ? (
                          <span className="text-tertiary">{t.wlNoFatigue}</span>
                        ) : (
                          <span className="flex flex-col items-start gap-1">
                            <StatusPill tone={toneOf(fatigueLevel(s.latestFatigue, workload))}>
                              {format(t.wlFatigue, { score: s.latestFatigue })}
                            </StatusPill>
                            <span className="text-muted-foreground max-w-44">
                              {
                                workload.fatigueScale.find((f) => f.score === s.latestFatigue)
                                  ?.label[lang]
                              }
                            </span>
                          </span>
                        )}
                      </TableCell>
                      <TableCell className="hidden py-3 text-xs tabular-nums xl:table-cell">
                        {s.averageSleep === null ? (
                          <span className="text-tertiary">{t.wlNoSleep}</span>
                        ) : (
                          <StatusPill
                            tone={s.averageSleep < workload.shortSleep ? 'amber' : 'muted'}
                          >
                            {format(t.wlSleep, { hours: s.averageSleep })}
                          </StatusPill>
                        )}
                      </TableCell>
                      <TableCell className="text-muted-foreground hidden min-w-52 py-3 pr-4 text-xs whitespace-normal 2xl:table-cell">
                        {s.reasons.length
                          ? s.reasons.map((r) => reasonText(r, row, t)).join(' · ')
                          : t.wlReasonNone}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
            <div className={panelTable.footer}>
              <span className="tabular-nums">
                {format(t.workloadFooter, { n: loaded, total: rows.length })}
              </span>
            </div>
          </div>
        </>
      )}
      <Collapsible>
        <CollapsibleTrigger className="text-muted-foreground hover:text-foreground hit-area flex min-h-8 items-center gap-1.5 text-xs">
          <Info aria-hidden="true" className="size-3.5" />
          {t.howCalculated}
        </CollapsibleTrigger>
        <CollapsibleContent className="text-muted-foreground max-w-3xl pt-1 text-xs">
          {t.workloadHowTo} {workload.source}
        </CollapsibleContent>
      </Collapsible>
    </section>
  );
}
