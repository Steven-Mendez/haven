import { type ReentryReadiness, reentry } from '@haven/core';
import { Activity, Droplets, Info, type LucideIcon, PlaneLanding, Shirt } from 'lucide-react';
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
import { cn } from '@/lib/utils';
import type { StoredMission } from '@/server/types';
import type { ExtrasTexts } from '../i18n';
import { daysToReentry, type ReentryRow } from '../logic/reentry';
import { getReentryReadiness } from '../server';
import {
  CrewCell,
  PanelHeading,
  panelTable,
  StatusPill,
  SummaryChips,
  type Tone,
  toneOf,
} from './panel-parts';

const READINESS: ReentryReadiness[] = ['ready', 'in-progress', 'review', 'unfit', 'not-started'];

const READINESS_TONE: Record<ReentryReadiness, Tone> = {
  ready: 'green',
  'in-progress': 'muted',
  'not-started': 'muted',
  review: 'amber',
  unfit: 'red',
};

const ITEM_ICON: Record<string, LucideIcon> = {
  'fluid-loading': Droplets,
  'compression-garment': Shirt,
  'orthostatic-test': Activity,
};

const readinessLabel = (r: ReentryReadiness, t: ExtrasTexts) => t[`reentry-${r}`];

function phaseText(mission: StoredMission, t: ExtrasTexts) {
  const days = daysToReentry(mission.phases, mission.day);
  if (days === null) return t.reentryNoPlan;
  const end = (mission.durationDays ?? 0) > 0 && mission.day > (mission.durationDays ?? 0);
  if (end) return t.reentryPast;
  if (days <= 0) return t.reentryNow;
  if (days === 1) return t.reentryTomorrow;
  return format(t.reentryIn, { n: days, day: mission.day + days });
}

/** The three checklist items as one segmented strip: green when done. */
function Checklist({ row, lang }: { row: ReentryRow; lang: Language }) {
  return (
    <ul className="bg-surface-elevated/60 inline-flex items-center divide-x rounded-md border">
      {reentry.checklist.map((item) => {
        const done = Boolean(row.status.items.find((i) => i.id === item.id)?.doneAt);
        const Icon = ITEM_ICON[item.id] ?? Activity;
        const label = `${item.name[lang]}: ${done ? '✓' : '—'}`;
        return (
          <li key={item.id}>
            <Hint label={label} side="top">
              <span
                className={cn(
                  'flex size-7 items-center justify-center',
                  done ? 'text-level-green' : 'text-tertiary',
                )}
              >
                <Icon aria-hidden="true" className="size-3.5" />
                <span className="sr-only">{label}</span>
              </span>
            </Hint>
          </li>
        );
      })}
    </ul>
  );
}

export async function ReentryPanel({
  mission,
  lang,
  t,
}: {
  mission: StoredMission;
  lang: Language;
  t: ExtrasTexts;
}) {
  const data = await getReentryReadiness(mission.code);
  const rows = data?.rows ?? [];
  const ready = rows.filter((r) => r.status.readiness === 'ready').length;

  return (
    <section aria-labelledby="reentry" className="flex min-w-0 flex-col gap-3">
      <PanelHeading
        id="reentry"
        title={t.reentryTitle}
        count={rows.length || undefined}
        description={t.reentryDescription}
      >
        <span
          className="border-brand/30 bg-brand-subtle text-link inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs"
          data-testid="reentry-phase"
        >
          <PlaneLanding aria-hidden="true" className="size-3.5" />
          {phaseText(mission, t)}
        </span>
      </PanelHeading>

      {rows.length === 0 || !data ? (
        <EmptyState title={t.reentryEmpty} description={t.reentryEmptyDetail} />
      ) : (
        <>
          <SummaryChips
            label={t.reentryStatus}
            items={READINESS.map((r) => ({
              key: r,
              tone: READINESS_TONE[r],
              label: readinessLabel(r, t),
              count: rows.filter((x) => x.status.readiness === r).length,
            }))}
          />
          <div className={panelTable.card}>
            <Table data-testid="reentry-table">
              <TableHeader className={panelTable.header}>
                <TableRow className={panelTable.headRow}>
                  <TableHead className="pl-4">{t.astronaut}</TableHead>
                  <TableHead>{t.reentryStatus}</TableHead>
                  <TableHead>{t.checklistCol}</TableHead>
                  <TableHead>{t.orthostaticCol}</TableHead>
                  <TableHead className="hidden xl:table-cell">{t.hydrationCol}</TableHead>
                  <TableHead className="hidden pr-4 xl:table-cell">{t.bloodPressureCol}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((row) => {
                  const o = row.status.orthostatic;
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
                      <TableCell className="py-3">
                        <StatusPill tone={READINESS_TONE[row.status.readiness]}>
                          {readinessLabel(row.status.readiness, t)}
                        </StatusPill>
                      </TableCell>
                      <TableCell className="py-3">
                        <div className="flex items-center gap-2">
                          <Checklist row={row} lang={lang} />
                          <span className="text-tertiary text-xs tabular-nums">
                            {row.status.done}/{row.status.total}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell className="py-3 text-xs whitespace-normal">
                        {o ? (
                          <span className="flex flex-col items-start gap-1">
                            <StatusPill tone={toneOf(o.level)}>+{o.rise} lpm</StatusPill>
                            <span className="text-muted-foreground tabular-nums">
                              {Number.isFinite(o.supine) ? o.supine : '—'} →{' '}
                              {Number.isFinite(o.standing) ? o.standing : '—'} lpm
                              {o.symptoms.length ? ` · ${t.orthostaticSymptoms}` : ''}
                            </span>
                          </span>
                        ) : (
                          <span className="text-tertiary">{t.notDone}</span>
                        )}
                      </TableCell>
                      <TableCell className="hidden py-3 xl:table-cell">
                        <StatusPill tone={toneOf(row.hydration)}>
                          {levelText(row.hydration, t)}
                        </StatusPill>
                      </TableCell>
                      <TableCell className="hidden py-3 pr-4 xl:table-cell">
                        <StatusPill tone={toneOf(row.bloodPressure)}>
                          {levelText(row.bloodPressure, t)}
                        </StatusPill>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
            <div className={panelTable.footer}>
              <span className="tabular-nums">
                {format(t.reentryFooter, { ready, total: rows.length })}
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
          {t.reentrySource}
        </CollapsibleContent>
      </Collapsible>
    </section>
  );
}

function levelText(level: string, t: ExtrasTexts) {
  return { green: t.scaleGreen, amber: t.scaleAmber, red: t.scaleRed }[level] ?? t.levelPending;
}
