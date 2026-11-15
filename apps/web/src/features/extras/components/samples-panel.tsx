import { type SampleResult, sampleConfig } from '@haven/core';
import { Info } from 'lucide-react';
import { AgeLabel, EmptyState, LevelGlyph, Section } from '@/components/haven';
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
import { SampleResultForm } from './sample-result-form';

const sampleOf = (id: string) => sampleConfig.samples.find((s) => s.id === id);

function moduleName(sample: string, module: string | undefined, lang: Language) {
  if (!module) return undefined;
  return sampleOf(sample)?.modules?.find((m) => m.id === module)?.name[lang] ?? module;
}

function dateText(iso: string, lang: Language) {
  return new Date(iso).toLocaleString(lang, {
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
    timeZone: 'UTC',
  });
}

function ResultLine({ result, lang, t }: { result: SampleResult; lang: Language; t: ExtrasTexts }) {
  const abnormal = result.result === 'abnormal';
  return (
    <span className="inline-flex items-center gap-1.5">
      <LevelGlyph level={abnormal ? 'red' : 'green'} size={8} />
      {abnormal ? t.resultAbnormal : t.resultNormal}
      {abnormal ? (
        <span className="text-muted-foreground">· {sampleOf(result.sample)?.abnormal[lang]}</span>
      ) : null}
    </span>
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

  return (
    <>
      <Section title={t.samplesTitle} description={t.samplesDescription}>
        {data ? <p className="text-sm">{format(t.samplesDay, { day: data.day })}</p> : null}
        {rows.length === 0 || !data ? (
          <EmptyState title={t.samplesEmpty} description={t.samplesEmptyDetail} />
        ) : (
          <div className="overflow-hidden rounded-xl border">
            <Table data-testid="samples-table">
              <TableHeader>
                <TableRow>
                  <TableHead className="pl-4">{t.astronaut}</TableHead>
                  {sampleConfig.samples.map((s) => (
                    <TableHead key={s.id}>{s.name[lang]}</TableHead>
                  ))}
                  <TableHead className="pr-4">{t.lastData}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((row) => (
                  <TableRow key={row.id} className="align-top">
                    <TableCell className="pl-4 font-medium">{row.name}</TableCell>
                    {row.states.map((state) => {
                      const result = row.results[state.sample];
                      const module = moduleName(state.sample, state.last?.module, lang);
                      return (
                        <TableCell key={state.sample} className="text-xs whitespace-normal">
                          <span className="flex flex-col gap-0.5">
                            <span className="inline-flex items-center gap-1.5">
                              <LevelGlyph level={STATUS_LEVEL[state.status]} size={10} />
                              {t[`sample-${state.status}`]}
                            </span>
                            {state.last ? (
                              <span className="text-muted-foreground">
                                {format(t.collectedOn, {
                                  date: dateText(state.last.takenAt, lang),
                                })}
                                {module ? ` · ${format(t.moduleLabel, { module })}` : ''}
                              </span>
                            ) : null}
                            <span className="text-muted-foreground">
                              {format(t.nextDay, { day: state.nextDay })}
                            </span>
                            {result ? <ResultLine result={result} lang={lang} t={t} /> : null}
                          </span>
                        </TableCell>
                      );
                    })}
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
            {t.samplesSource} {sampleConfig.source}
          </CollapsibleContent>
        </Collapsible>
      </Section>

      {data ? (
        <Section title={t.pendingTitle}>
          {data.pending.length === 0 ? (
            <p className="text-muted-foreground text-sm">{t.pendingEmpty}</p>
          ) : (
            <ul className="flex flex-col divide-y rounded-xl border">
              {data.pending.map((p) => {
                const module = moduleName(p.sample, p.module, lang);
                return (
                  <li key={p.id} className="flex flex-col gap-2 px-4 py-3">
                    <span className="text-sm">
                      <span className="font-medium">{p.name}</span> ·{' '}
                      {sampleOf(p.sample)?.name[lang] ?? p.sample}
                      {module ? ` · ${format(t.moduleLabel, { module })}` : ''}
                      <span className="text-muted-foreground">
                        {' '}
                        · {format(t.collectedOn, { date: dateText(p.collectedAt, lang) })}
                      </span>
                    </span>
                    <SampleResultForm id={p.id} lang={lang} />
                  </li>
                );
              })}
            </ul>
          )}
        </Section>
      ) : null}

      {data ? (
        <Section title={t.recentResults}>
          {data.results.length === 0 ? (
            <p className="text-muted-foreground text-sm">{t.noResults}</p>
          ) : (
            <ul className="flex flex-col divide-y rounded-xl border text-xs">
              {data.results.slice(0, 12).map((r) => (
                <li key={r.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 px-4 py-2.5">
                  <span className="font-medium">
                    {data.rows.find((row) => row.id === r.crewMember)?.name ?? r.crewMember}
                  </span>
                  <span>{sampleOf(r.sample)?.name[lang] ?? r.sample}</span>
                  <span className="text-muted-foreground">{dateText(r.collectedAt, lang)}</span>
                  <ResultLine result={r} lang={lang} t={t} />
                  {r.detail ? <span className="text-muted-foreground">“{r.detail}”</span> : null}
                </li>
              ))}
            </ul>
          )}
        </Section>
      ) : null}
    </>
  );
}
