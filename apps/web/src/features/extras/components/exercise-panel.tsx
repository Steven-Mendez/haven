import { type ExerciseDay, type ExerciseSuggestion, exercise, type Level } from '@haven/core';
import { ArrowDown, ArrowUp, Equal, Info, type LucideIcon } from 'lucide-react';
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
import type { ExerciseRow } from '../logic/exercise';
import { getExerciseOverview } from '../server';
import { ExercisePlanSheet } from './exercise-plan-sheet';
import {
  CrewCell,
  PanelHeading,
  panelTable,
  StatusPill,
  SummaryChips,
  type Tone,
  toneOf,
} from './panel-parts';

const COMPLIANCE: { level: Level; label: (t: ExtrasTexts) => string }[] = [
  { level: 'green', label: (t) => t.exComplianceGood },
  { level: 'amber', label: (t) => t.exComplianceIrregular },
  { level: 'red', label: (t) => t.exComplianceLow },
  { level: 'pending', label: (t) => t.exCompliancePending },
];

const complianceLabel = (level: Level, t: ExtrasTexts) =>
  COMPLIANCE.find((c) => c.level === level)?.label(t) ?? t.exCompliancePending;

const DAY_COLOR: Partial<Record<ExerciseDay['status'], string>> = {
  met: 'var(--scale-green)',
  partial: 'var(--scale-amber)',
  rest: 'var(--scale-red)',
};

export const SUGGESTION: Record<
  ExerciseSuggestion,
  { tone: Tone; icon: LucideIcon; label: (t: ExtrasTexts) => string }
> = {
  raise: { tone: 'green', icon: ArrowUp, label: (t) => t.exRaise },
  keep: { tone: 'muted', icon: Equal, label: (t) => t.exKeep },
  lower: { tone: 'amber', icon: ArrowDown, label: (t) => t.exLower },
};

export function dayStatusText(status: ExerciseDay['status'], t: ExtrasTexts) {
  return {
    met: t.exDayMet,
    partial: t.exDayPartial,
    rest: t.exDayRest,
    open: t.exDayOpen,
    before: t.exDayBefore,
  }[status];
}

export function assessmentText(row: ExerciseRow, t: ExtrasTexts) {
  const a = row.assessment;
  if (!a) return '';
  const pain = { none: t.exPainNone, mild: t.exPainMild, strong: t.exPainStrong }[a.pain];
  const completion = {
    full: t.exCompletionFull,
    partial: t.exCompletionPartial,
    none: t.exCompletionNone,
  }[a.completion];
  return format(t.exAssessmentDetail, { effort: a.effort, pain, completion });
}

/** The last 7 days as one segmented strip, each day colored by whether it met the prescription. */
function WeekStrip({ row, lang, t }: { row: ExerciseRow; lang: Language; t: ExtrasTexts }) {
  return (
    <ul className="bg-surface-elevated/60 inline-flex items-center divide-x rounded-md border">
      {row.week.map((d) => {
        const color = DAY_COLOR[d.status];
        const day = new Date(`${d.day}T12:00:00Z`).toLocaleDateString(lang, {
          weekday: 'short',
          day: 'numeric',
          timeZone: 'UTC',
        });
        const total = d.minutes.resistance + d.minutes.aerobic;
        const label = `${day}: ${dayStatusText(d.status, t)} · ${total} min`;
        return (
          <li key={d.day}>
            <Hint label={label} side="top">
              <span className="flex size-7 items-center justify-center">
                <span
                  aria-hidden="true"
                  className={
                    d.status === 'open'
                      ? 'border-muted-foreground size-3 rounded-sm border border-dashed'
                      : 'size-3 rounded-sm'
                  }
                  style={{
                    background: color
                      ? `color-mix(in oklab, ${color} ${d.status === 'met' ? 80 : 55}%, transparent)`
                      : d.status === 'before'
                        ? 'var(--muted)'
                        : undefined,
                  }}
                />
                <span className="sr-only">{label}</span>
              </span>
            </Hint>
          </li>
        );
      })}
    </ul>
  );
}

function TodayCell({ row, t }: { row: ExerciseRow; t: ExtrasTexts }) {
  const parts = [
    {
      label: t.exResistance,
      done: row.today.resistance,
      target: row.prescription.resistanceMinutes,
    },
    { label: t.exAerobic, done: row.today.aerobic, target: row.prescription.aerobicMinutes },
  ];
  return (
    <ul className="flex flex-col items-start gap-1">
      {parts.map((p) => (
        <li key={p.label}>
          <StatusPill tone={p.done >= p.target ? 'green' : 'muted'}>
            {p.label} {format(t.exMinutesOf, { done: p.done, target: p.target })}
          </StatusPill>
        </li>
      ))}
    </ul>
  );
}

function AssessmentCell({ row, t }: { row: ExerciseRow; t: ExtrasTexts }) {
  const suggestion = row.suggestion ? SUGGESTION[row.suggestion] : undefined;
  return (
    <span className="flex flex-col items-start gap-1">
      {row.assessmentDue ? (
        <StatusPill tone="amber">{t.exAssessmentDue}</StatusPill>
      ) : suggestion ? (
        <StatusPill tone={suggestion.tone} icon={suggestion.icon}>
          {suggestion.label(t)}
        </StatusPill>
      ) : (
        <span className="text-tertiary">{t.exAssessmentNone}</span>
      )}
      {row.assessment ? (
        <span className="text-muted-foreground">{assessmentText(row, t)}</span>
      ) : null}
    </span>
  );
}

export async function ExercisePanel({
  mission,
  lang,
  t,
}: {
  mission: string;
  lang: Language;
  t: ExtrasTexts;
}) {
  const data = await getExerciseOverview(mission);
  const rows = data?.rows ?? [];
  const meeting = rows.filter((r) => r.compliance.level === 'green').length;

  return (
    <section aria-labelledby="exercise" className="flex min-w-0 flex-col gap-3">
      <PanelHeading
        id="exercise"
        title={t.exerciseTitle}
        count={rows.length || undefined}
        description={t.exerciseDescription}
      />
      {rows.length === 0 || !data ? (
        <EmptyState title={t.exerciseEmpty} description={t.exerciseEmptyDetail} />
      ) : (
        <>
          <SummaryChips
            label={t.exComplianceCol}
            items={COMPLIANCE.map((c) => ({
              key: c.level,
              tone: toneOf(c.level),
              label: c.label(t),
              count: rows.filter((r) => r.compliance.level === c.level).length,
            }))}
          />
          <div className={panelTable.card}>
            <Table data-testid="exercise-table">
              <TableHeader className={panelTable.header}>
                <TableRow className={panelTable.headRow}>
                  <TableHead className="pl-4">{t.astronaut}</TableHead>
                  <TableHead>{t.exComplianceCol}</TableHead>
                  <TableHead className="hidden xl:table-cell">{t.exWeekCol}</TableHead>
                  <TableHead className="hidden min-[1800px]:table-cell">{t.exTodayCol}</TableHead>
                  <TableHead className="hidden xl:table-cell">{t.exPrescriptionCol}</TableHead>
                  <TableHead>{t.exAssessmentCol}</TableHead>
                  <TableHead className="w-12 pr-4">
                    <span className="sr-only">{t.exEditPrescription}</span>
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
                        <StatusPill tone={toneOf(row.compliance.level)}>
                          {complianceLabel(row.compliance.level, t)}
                        </StatusPill>
                        <span className="text-muted-foreground tabular-nums">
                          {row.compliance.counted === 0
                            ? t.exNoClosedDays
                            : format(t.exDaysMet, {
                                met: row.compliance.met,
                                target: row.compliance.target,
                              })}
                        </span>
                      </span>
                    </TableCell>
                    <TableCell className="hidden py-3 xl:table-cell">
                      <WeekStrip row={row} lang={lang} t={t} />
                    </TableCell>
                    <TableCell className="hidden py-3 text-xs min-[1800px]:table-cell">
                      <TodayCell row={row} t={t} />
                    </TableCell>
                    <TableCell className="hidden py-3 text-xs whitespace-normal xl:table-cell">
                      <span className="flex flex-col items-start gap-1">
                        <span className="whitespace-nowrap tabular-nums">
                          {format(t.exPrescriptionText, {
                            resistance: row.prescription.resistanceMinutes,
                            aerobic: row.prescription.aerobicMinutes,
                            days: row.prescription.daysPerWeek,
                          })}
                        </span>
                        <span className="text-tertiary">
                          {row.custom ? t.exCustom : t.exDefault}
                        </span>
                      </span>
                    </TableCell>
                    <TableCell className="py-3 text-xs whitespace-normal">
                      <AssessmentCell row={row} t={t} />
                    </TableCell>
                    <TableCell className="py-3 pr-3 text-right">
                      <ExercisePlanSheet
                        crewMember={row.id}
                        name={row.name}
                        prescription={row.prescription}
                        custom={row.custom}
                        suggestion={
                          row.suggestion ? SUGGESTION[row.suggestion].label(t) : undefined
                        }
                        assessment={assessmentText(row, t) || undefined}
                        lang={lang}
                      />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            <div className={panelTable.footer}>
              <span className="tabular-nums">
                {format(t.exFooter, { n: meeting, total: rows.length })}
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
          {t.exerciseSource} {exercise.source}
        </CollapsibleContent>
      </Collapsible>
    </section>
  );
}
