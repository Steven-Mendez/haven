import { type ExerciseDay, type ExerciseSuggestion, exercise, type Level } from '@haven/core';
import { ArrowDown, ArrowUp, Equal, Info, type LucideIcon } from 'lucide-react';
import { AgeLabel, EmptyState, Hint } from '@/components/haven';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { format, type Language } from '@/lib/i18n';
import type { ExtrasTexts } from '../i18n';
import type { ExerciseRow } from '../logic/exercise';
import { getExerciseOverview } from '../server';
import { CrewTable } from './crew-table';
import { ExercisePlanSheet } from './exercise-plan-sheet';
import { CrewCell, crewHref, crewTableTexts, StatusPill, type Tone, toneOf } from './panel-parts';

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
    <div className="flex min-w-0 flex-col gap-3">
      {rows.length === 0 || !data ? (
        <EmptyState title={t.exerciseEmpty} description={t.exerciseEmptyDetail} />
      ) : (
        <CrewTable
          id="exercise"
          testId="exercise-table"
          title={t.exerciseTitle}
          description={t.exerciseDescription}
          groups={COMPLIANCE.map((c) => ({
            key: c.level,
            tone: toneOf(c.level),
            label: c.label(t),
          }))}
          columns={[
            { label: t.astronaut },
            { label: t.exComplianceCol },
            { label: t.exWeekCol, className: 'hidden xl:table-cell' },
            { label: t.exPrescriptionCol, className: 'hidden whitespace-normal xl:table-cell' },
            { label: t.exAssessmentCol, className: 'whitespace-normal' },
            {
              label: <span className="sr-only">{t.exEditPrescription}</span>,
              className: 'w-12 text-right',
            },
          ]}
          rows={rows.map((row) => ({
            id: row.id,
            name: row.name,
            group: row.compliance.level,
            href: crewHref(row.id),
            cells: [
              <CrewCell
                key="crew"
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
              />,
              <span key="compliance" className="flex flex-col items-start gap-1">
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
              </span>,
              <WeekStrip key="week" row={row} lang={lang} t={t} />,
              <span key="prescription" className="flex flex-col items-start gap-1">
                <span className="whitespace-nowrap tabular-nums">
                  {format(t.exPrescriptionText, {
                    resistance: row.prescription.resistanceMinutes,
                    aerobic: row.prescription.aerobicMinutes,
                    days: row.prescription.daysPerWeek,
                  })}
                </span>
                <span className="text-tertiary">{row.custom ? t.exCustom : t.exDefault}</span>
              </span>,
              <AssessmentCell key="assessment" row={row} t={t} />,
              <ExercisePlanSheet
                key="edit"
                crewMember={row.id}
                name={row.name}
                prescription={row.prescription}
                custom={row.custom}
                suggestion={row.suggestion ? SUGGESTION[row.suggestion].label(t) : undefined}
                assessment={assessmentText(row, t) || undefined}
                lang={lang}
              />,
            ],
          }))}
          summary={format(t.exFooter, { n: meeting, total: rows.length })}
          texts={crewTableTexts(t, true)}
        />
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
    </div>
  );
}
