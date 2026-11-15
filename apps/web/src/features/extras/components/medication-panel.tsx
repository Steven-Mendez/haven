import { type MedicationSchedule, medications } from '@haven/core';
import { Info, Pill } from 'lucide-react';
import { AgeLabel, EmptyState } from '@/components/haven';
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
import { type MedicationRow, weekdayName } from '../logic/medication';
import { getMedicationOverview } from '../server';
import { MedicationPlanSheet } from './medication-plan-sheet';
import {
  CrewCell,
  PanelHeading,
  panelTable,
  StatusPill,
  SummaryChips,
  type Tone,
  toneOf,
} from './panel-parts';

function scheduleText(s: MedicationSchedule | undefined, lang: Language, t: ExtrasTexts) {
  if (!s) return '';
  if (s.kind === 'as-needed') return format(t.scheduleAsNeeded, { n: s.maxPerDay });
  const times = s.times.join(', ');
  return s.kind === 'weekly'
    ? format(t.scheduleWeekly, { weekday: weekdayName(s.weekday, lang), times })
    : format(t.scheduleDaily, { times });
}

const nameOf = (id: string, lang: Language) =>
  medications.catalog.find((m) => m.id === id)?.name[lang] ?? id;

/** Today's doses: green when all taken, red with a missed one, amber when one is due. */
function TodayCell({ row, t }: { row: MedicationRow; t: ExtrasTexts }) {
  const count = (status: string) => row.today.filter((d) => d.status === status).length;
  if (row.today.length === 0) return <span className="text-tertiary">{t.noScheduled}</span>;
  const tone: Tone = count('missed')
    ? 'red'
    : count('due') || count('skipped')
      ? 'amber'
      : count('taken') === row.today.length
        ? 'green'
        : 'muted';
  const parts = [
    count('due') ? format(t.dueNow, { n: count('due') }) : '',
    count('missed') ? format(t.missedToday, { n: count('missed') }) : '',
    count('skipped') ? format(t.skippedToday, { n: count('skipped') }) : '',
  ].filter(Boolean);
  return (
    <span className="flex flex-col items-start gap-1">
      <StatusPill tone={tone}>
        {format(t.dosesToday, { taken: count('taken'), total: row.today.length })}
      </StatusPill>
      {parts.length ? <span className="text-muted-foreground">{parts.join(' · ')}</span> : null}
    </span>
  );
}

const ADHERENCE: { level: string; label: (t: ExtrasTexts) => string }[] = [
  { level: 'green', label: (t) => t.adherenceGood },
  { level: 'amber', label: (t) => t.adherenceIrregular },
  { level: 'red', label: (t) => t.adherenceLow },
  { level: 'pending', label: (t) => t.adherencePending },
];

const adherenceLabel = (level: string, t: ExtrasTexts) =>
  ADHERENCE.find((a) => a.level === level)?.label(t) ?? t.adherencePending;

export async function MedicationPanel({
  mission,
  lang,
  t,
}: {
  mission: string;
  lang: Language;
  t: ExtrasTexts;
}) {
  const data = await getMedicationOverview(mission);
  const rows = data?.rows ?? [];
  /** Readable schedule of each medication for one crew member: Earth's change or the catalog's. */
  const schedulesFor = (row: MedicationRow) =>
    Object.fromEntries(
      medications.catalog.map((m) => [
        m.id,
        scheduleText(
          row.plan.medications.find((a) => a.medication === m.id)?.schedule ?? m.schedule,
          lang,
          t,
        ),
      ]),
    );
  const withPlan = rows.filter((r) => r.plan.medications.length > 0).length;

  return (
    <section aria-labelledby="medication" className="flex min-w-0 flex-col gap-3">
      <PanelHeading
        id="medication"
        title={t.medicationTitle}
        count={rows.length || undefined}
        description={t.medicationDescription}
      />
      {rows.length === 0 || !data ? (
        <EmptyState title={t.medicationEmpty} description={t.medicationEmptyDetail} />
      ) : (
        <>
          <SummaryChips
            label={t.adherenceCol}
            items={ADHERENCE.map((a) => ({
              key: a.level,
              tone: toneOf(a.level),
              label: a.label(t),
              count: rows.filter((r) => r.level === a.level).length,
            }))}
          />
          <div className={panelTable.card}>
            <Table data-testid="medication-table">
              <TableHeader className={panelTable.header}>
                <TableRow className={panelTable.headRow}>
                  <TableHead className="pl-4">{t.astronaut}</TableHead>
                  <TableHead>{t.adherenceCol}</TableHead>
                  <TableHead>{t.todayCol}</TableHead>
                  <TableHead>{t.planCol}</TableHead>
                  <TableHead className="hidden xl:table-cell">{t.asNeededCol}</TableHead>
                  <TableHead className="w-12 pr-4">
                    <span className="sr-only">{t.editPlan}</span>
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((row) => (
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
                        <StatusPill tone={toneOf(row.level)}>
                          {row.adherence.percent === null
                            ? adherenceLabel(row.level, t)
                            : `${row.adherence.percent} % · ${adherenceLabel(row.level, t)}`}
                        </StatusPill>
                        <span className="text-muted-foreground tabular-nums">
                          {row.adherence.percent === null
                            ? t.adherenceNone
                            : format(t.adherenceDoses, {
                                taken: row.adherence.taken,
                                expected: row.adherence.expected,
                              })}
                        </span>
                      </span>
                    </TableCell>
                    <TableCell className="py-3 text-xs whitespace-normal">
                      <TodayCell row={row} t={t} />
                    </TableCell>
                    <TableCell className="py-3 text-xs whitespace-normal">
                      {row.plan.medications.length === 0 ? (
                        <span className="text-tertiary">{t.noPlan}</span>
                      ) : (
                        <ul className="flex max-w-xs flex-wrap gap-1">
                          {row.plan.medications.map((a) => (
                            <li
                              key={a.medication}
                              className="bg-surface-elevated/60 text-muted-foreground inline-flex items-center gap-1 rounded-md border px-1.5 py-0.5 whitespace-nowrap"
                            >
                              <Pill aria-hidden="true" className="text-tertiary size-3" />
                              {nameOf(a.medication, lang)}
                              {a.until ? <span className="text-tertiary">→ {a.until}</span> : null}
                            </li>
                          ))}
                        </ul>
                      )}
                    </TableCell>
                    <TableCell className="hidden py-3 text-xs whitespace-normal xl:table-cell">
                      {row.asNeeded.length === 0 ? (
                        <span className="text-tertiary">—</span>
                      ) : (
                        <ul className="flex flex-col items-start gap-1">
                          {row.asNeeded.map((a) => (
                            <li key={a.medication}>
                              <StatusPill tone={a.canTake ? 'muted' : 'amber'}>
                                {nameOf(a.medication, lang)} {a.taken}/{a.maxPerDay}
                              </StatusPill>
                            </li>
                          ))}
                        </ul>
                      )}
                    </TableCell>
                    <TableCell className="py-3 pr-3 text-right">
                      <MedicationPlanSheet
                        crewMember={row.id}
                        name={row.name}
                        plan={row.plan}
                        catalog={medications.catalog}
                        schedules={schedulesFor(row)}
                        lang={lang}
                      />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            <div className={panelTable.footer}>
              <span className="tabular-nums">
                {format(t.medicationFooter, { n: withPlan, total: rows.length })}
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
          {t.medicationSource} {medications.source}
        </CollapsibleContent>
      </Collapsible>
    </section>
  );
}
