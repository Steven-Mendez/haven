import { type MedicationSchedule, medications } from '@haven/core';
import { Info } from 'lucide-react';
import { AgeLabel, EmptyState, LevelBadge, LevelGlyph, Section } from '@/components/haven';
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
import { MedicationPlanForm } from './medication-plan-form';

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

function TodayCell({ row, t }: { row: MedicationRow; t: ExtrasTexts }) {
  const count = (status: string) => row.today.filter((d) => d.status === status).length;
  if (row.today.length === 0) return <span className="text-muted-foreground">{t.noScheduled}</span>;
  const parts = [
    count('due') ? format(t.dueNow, { n: count('due') }) : '',
    count('missed') ? format(t.missedToday, { n: count('missed') }) : '',
    count('skipped') ? format(t.skippedToday, { n: count('skipped') }) : '',
  ].filter(Boolean);
  return (
    <span className="flex flex-col gap-0.5">
      <span className="tabular-nums">
        {format(t.dosesToday, { taken: count('taken'), total: row.today.length })}
      </span>
      {parts.length ? <span className="text-muted-foreground">{parts.join(' · ')}</span> : null}
    </span>
  );
}

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

  return (
    <Section title={t.medicationTitle} description={t.medicationDescription}>
      {rows.length === 0 || !data ? (
        <EmptyState title={t.medicationEmpty} description={t.medicationEmptyDetail} />
      ) : (
        <div className="overflow-hidden rounded-xl border">
          <Table data-testid="medication-table">
            <TableHeader>
              <TableRow>
                <TableHead className="pl-4">{t.astronaut}</TableHead>
                <TableHead>{t.adherenceCol}</TableHead>
                <TableHead>{t.todayCol}</TableHead>
                <TableHead>{t.planCol}</TableHead>
                <TableHead>{t.asNeededCol}</TableHead>
                <TableHead className="pr-4">{t.lastData}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((row) => (
                <TableRow key={row.id} className="align-top">
                  <TableCell className="pl-4 font-medium">
                    <div className="flex flex-col gap-2">
                      {row.name}
                      <Collapsible>
                        <CollapsibleTrigger className="text-link text-xs font-normal hover:underline">
                          {t.editPlan}
                        </CollapsibleTrigger>
                        <CollapsibleContent className="w-[min(36rem,80vw)] pt-2 font-normal">
                          <MedicationPlanForm
                            crewMember={row.id}
                            plan={row.plan}
                            catalog={medications.catalog}
                            schedules={schedulesFor(row)}
                            lang={lang}
                          />
                        </CollapsibleContent>
                      </Collapsible>
                    </div>
                  </TableCell>
                  <TableCell className="text-xs">
                    <span className="flex flex-col gap-1">
                      <LevelBadge
                        level={row.level}
                        lang={lang}
                        label={
                          {
                            green: t.adherenceGood,
                            amber: t.adherenceIrregular,
                            red: t.adherenceLow,
                            pending: t.adherencePending,
                          }[row.level]
                        }
                      />
                      <span className="text-muted-foreground tabular-nums">
                        {row.adherence.percent === null
                          ? t.adherenceNone
                          : format(t.adherenceValue, {
                              percent: row.adherence.percent,
                              taken: row.adherence.taken,
                              expected: row.adherence.expected,
                            })}
                      </span>
                    </span>
                  </TableCell>
                  <TableCell className="text-xs whitespace-normal">
                    <TodayCell row={row} t={t} />
                  </TableCell>
                  <TableCell className="text-xs whitespace-normal">
                    {row.plan.medications.length === 0 ? (
                      <span className="text-muted-foreground">{t.noPlan}</span>
                    ) : (
                      <ul className="flex flex-col gap-0.5">
                        {row.plan.medications.map((a) => (
                          <li key={a.medication}>
                            {nameOf(a.medication, lang)}
                            {a.until ? (
                              <span className="text-muted-foreground"> · → {a.until}</span>
                            ) : null}
                          </li>
                        ))}
                      </ul>
                    )}
                  </TableCell>
                  <TableCell className="text-xs whitespace-normal">
                    {row.asNeeded.length === 0 ? (
                      <span className="text-muted-foreground">—</span>
                    ) : (
                      <ul className="flex flex-col gap-0.5">
                        {row.asNeeded.map((a) => (
                          <li key={a.medication} className="flex items-center gap-1.5 tabular-nums">
                            <LevelGlyph level={a.canTake ? 'green' : 'amber'} size={8} />
                            {nameOf(a.medication, lang)}: {a.taken}/{a.maxPerDay}
                          </li>
                        ))}
                      </ul>
                    )}
                  </TableCell>
                  <TableCell className="pr-4">
                    <AgeLabel
                      lastDataAt={row.lastDataAt}
                      now={data.generatedAt}
                      lang={lang}
                      noRecentData={row.noRecentData}
                    />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
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
    </Section>
  );
}
