import { type SampleResult, sampleConfig } from '@haven/core';
import { CalendarDays, Info } from 'lucide-react';
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
import { STATUS_LEVEL } from '../logic/samples';
import { getSampleOverview } from '../server';
import {
  CrewCell,
  IconTile,
  PanelHeading,
  panelTable,
  StatusPill,
  SummaryChips,
  type Tone,
  toneOf,
} from './panel-parts';
import { dateText, resultLabel, SAMPLE_ICON, SampleFile, valuesText } from './sample-file';

const sampleOf = (id: string) => sampleConfig.samples.find((s) => s.id === id);

function moduleName(sample: string, module: string | undefined, lang: Language) {
  if (!module) return undefined;
  return sampleOf(sample)?.modules?.find((m) => m.id === module)?.name[lang] ?? module;
}

const RESULT_TONE: Record<SampleResult['result'], Tone> = {
  normal: 'green',
  abnormal: 'amber',
  critical: 'red',
};

function ResultPill({ result, t }: { result: SampleResult; t: ExtrasTexts }) {
  return (
    <StatusPill tone={RESULT_TONE[result.result]}>
      {resultLabel(result.result, t)}
      {result.overridden ? ` (${t.overridden})` : ''}
    </StatusPill>
  );
}

export async function SamplesPanel({
  mission,
  lang,
  t,
}: {
  mission: string;
  lang: Language;
  t: ExtrasTexts;
}) {
  const data = await getSampleOverview(mission);
  const rows = data?.rows ?? [];
  const states = rows.flatMap((r) => r.states);
  const count = (status: string) => states.filter((s) => s.status === status).length;
  const flagged = (data?.results ?? []).filter((r) => r.result !== 'normal').length;

  return (
    <div className="flex min-w-0 flex-col gap-8">
      <section aria-labelledby="samples" className="flex min-w-0 flex-col gap-3">
        <PanelHeading
          id="samples"
          title={t.samplesTitle}
          count={rows.length || undefined}
          description={t.samplesDescription}
        >
          {data ? (
            <span className="border-brand/30 bg-brand-subtle text-link inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs">
              <CalendarDays aria-hidden="true" className="size-3.5" />
              {format(t.samplesDay, { day: data.day })}
            </span>
          ) : null}
        </PanelHeading>
        {rows.length === 0 || !data ? (
          <EmptyState title={t.samplesEmpty} description={t.samplesEmptyDetail} />
        ) : (
          <>
            <SummaryChips
              label={t.samplesTitle}
              items={[
                {
                  key: 'overdue',
                  tone: 'red',
                  label: t['sample-overdue'],
                  count: count('overdue'),
                },
                { key: 'due', tone: 'amber', label: t['sample-due'], count: count('due') },
                {
                  key: 'collected',
                  tone: 'green',
                  label: t['sample-collected'],
                  count: count('collected'),
                },
                {
                  key: 'pending',
                  tone: 'muted',
                  label: t.pendingTitle,
                  count: data.pending.length,
                },
                { key: 'flagged', tone: 'amber', label: t.flaggedResults, count: flagged },
              ]}
            />
            <div className={panelTable.card}>
              <Table data-testid="samples-table">
                <TableHeader className={panelTable.header}>
                  <TableRow className={panelTable.headRow}>
                    <TableHead className="pl-4">{t.astronaut}</TableHead>
                    {sampleConfig.samples.map((s) => {
                      const Icon = SAMPLE_ICON[s.id];
                      return (
                        <TableHead key={s.id}>
                          <span className="inline-flex items-center gap-1.5">
                            {Icon ? <Icon aria-hidden="true" className="size-3.5" /> : null}
                            {s.name[lang]}
                          </span>
                        </TableHead>
                      );
                    })}
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
                      {row.states.map((state) => {
                        const result = row.results[state.sample];
                        const module = moduleName(state.sample, state.last?.module, lang);
                        return (
                          <TableCell key={state.sample} className="py-3 text-xs whitespace-normal">
                            <span className="flex flex-col items-start gap-1">
                              <StatusPill tone={toneOf(STATUS_LEVEL[state.status])}>
                                {t[`sample-${state.status}`]}
                              </StatusPill>
                              {state.last ? (
                                <span className="text-muted-foreground">
                                  {dateText(state.last.takenAt, lang)}
                                  {module ? ` · ${module}` : ''}
                                </span>
                              ) : null}
                              <span className="text-tertiary">
                                {format(t.nextDay, { day: state.nextDay })}
                              </span>
                              {result ? <ResultPill result={result} t={t} /> : null}
                            </span>
                          </TableCell>
                        );
                      })}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              <div className={panelTable.footer}>
                <span className="tabular-nums">
                  {format(t.samplesFooter, {
                    collected: count('collected'),
                    total: states.length,
                  })}
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
            {t.samplesSource} {sampleConfig.source}
          </CollapsibleContent>
        </Collapsible>
      </section>

      {data ? (
        <section aria-labelledby="pending" className="flex min-w-0 flex-col gap-3">
          <PanelHeading
            id="pending"
            title={t.pendingTitle}
            count={data.pending.length}
            description={t.pendingDescription}
          />
          {data.pending.length === 0 ? (
            <p className="text-muted-foreground text-sm">{t.pendingEmpty}</p>
          ) : (
            <ul className={`${panelTable.card} divide-y`}>
              {data.pending.map((p) => (
                <SampleFile key={p.id} item={p} lang={lang} t={t} />
              ))}
            </ul>
          )}
        </section>
      ) : null}

      {data ? (
        <section aria-labelledby="recent" className="flex min-w-0 flex-col gap-3">
          <PanelHeading id="recent" title={t.recentResults} count={data.results.length} />
          {data.results.length === 0 ? (
            <p className="text-muted-foreground text-sm">{t.noResults}</p>
          ) : (
            <ul className={`${panelTable.card} divide-y text-xs`}>
              {data.results.slice(0, 12).map((r) => (
                <li key={r.id} className="group/row flex flex-wrap items-center gap-3 px-4 py-3">
                  <IconTile icon={SAMPLE_ICON[r.sample]} />
                  <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                    <span className="text-sm">
                      <span className="font-medium">
                        {data.rows.find((row) => row.id === r.crewMember)?.name ?? r.crewMember}
                      </span>
                      <span className="text-muted-foreground">
                        {' '}
                        · {sampleOf(r.sample)?.name[lang] ?? r.sample} ·{' '}
                        {dateText(r.collectedAt, lang)}
                      </span>
                    </span>
                    {r.values ? (
                      <span className="text-muted-foreground tabular-nums">
                        {valuesText(r, lang)}
                      </span>
                    ) : null}
                    {r.result !== 'normal' ? (
                      <span className="text-muted-foreground">
                        {sampleOf(r.sample)?.abnormal[lang]}
                      </span>
                    ) : null}
                    {r.detail ? <span className="text-tertiary">“{r.detail}”</span> : null}
                  </div>
                  <ResultPill result={r} t={t} />
                </li>
              ))}
            </ul>
          )}
        </section>
      ) : null}
    </div>
  );
}
