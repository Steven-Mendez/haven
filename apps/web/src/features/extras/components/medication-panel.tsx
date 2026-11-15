import { type MedicationSchedule, medications } from '@haven/core';
import { Info, Pill } from 'lucide-react';
import { AgeLabel, EmptyState } from '@/components/haven';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { format, type Language } from '@/lib/i18n';
import type { ExtrasTexts } from '../i18n';
import { type MedicationRow, weekdayName } from '../logic/medication';
import { getMedicationOverview } from '../server';
import { CrewTable } from './crew-table';
import { MedicationPlanSheet } from './medication-plan-sheet';
import { CrewCell, crewHref, crewTableTexts, StatusPill, type Tone, toneOf } from './panel-parts';

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
    <div className="flex min-w-0 flex-col gap-3">
      {rows.length === 0 || !data ? (
        <EmptyState title={t.medicationEmpty} description={t.medicationEmptyDetail} />
      ) : (
        <CrewTable
          id="medication"
          testId="medication-table"
          title={t.medicationTitle}
          description={t.medicationDescription}
          groups={ADHERENCE.map((a) => ({
            key: a.level,
            tone: toneOf(a.level),
            label: a.label(t),
          }))}
          columns={[
            { label: t.astronaut },
            { label: t.adherenceCol },
            { label: t.todayCol, className: 'whitespace-normal' },
            { label: t.planCol, className: 'whitespace-normal' },
            { label: t.asNeededCol, className: 'hidden whitespace-normal xl:table-cell' },
            { label: <span className="sr-only">{t.editPlan}</span>, className: 'w-12 text-right' },
          ]}
          rows={rows.map((row) => ({
            id: row.id,
            name: row.name,
            group: row.level,
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
              <span key="adherence" className="flex flex-col items-start gap-1">
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
              </span>,
              <TodayCell key="today" row={row} t={t} />,
              row.plan.medications.length === 0 ? (
                <span key="plan" className="text-tertiary">
                  {t.noPlan}
                </span>
              ) : (
                <ul key="plan" className="flex max-w-xs flex-wrap gap-1">
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
              ),
              row.asNeeded.length === 0 ? (
                <span key="as-needed" className="text-tertiary">
                  —
                </span>
              ) : (
                <ul key="as-needed" className="flex flex-col items-start gap-1">
                  {row.asNeeded.map((a) => (
                    <li key={a.medication}>
                      <StatusPill tone={a.canTake ? 'muted' : 'amber'}>
                        {nameOf(a.medication, lang)} {a.taken}/{a.maxPerDay}
                      </StatusPill>
                    </li>
                  ))}
                </ul>
              ),
              <MedicationPlanSheet
                key="edit"
                crewMember={row.id}
                name={row.name}
                plan={row.plan}
                catalog={medications.catalog}
                schedules={schedulesFor(row)}
                lang={lang}
              />,
            ],
          }))}
          summary={format(t.medicationFooter, { n: withPlan, total: rows.length })}
          texts={crewTableTexts(t, true)}
        />
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
    </div>
  );
}
