import { type SampleResult, sampleConfig, symptomById, unitLabel } from '@haven/core';
import { CircleAlert } from 'lucide-react';
import { LevelGlyph } from '@/components/haven';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { format, type Language } from '@/lib/i18n';
import { baseConfig } from '@/server/model';
import type { ExtrasTexts } from '../i18n';
import { type PendingSample, RESULT_LEVEL } from '../logic/samples';
import { SampleResultForm } from './sample-result-form';

const sampleOf = (id: string) => sampleConfig.samples.find((s) => s.id === id);

export function dateText(iso: string, lang: Language) {
  return new Date(iso).toLocaleString(lang, {
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
    timeZone: 'UTC',
  });
}

export function resultLabel(level: SampleResult['result'], t: ExtrasTexts) {
  return { normal: t.resultNormal, abnormal: t.resultAbnormal, critical: t.resultCritical }[level];
}

/** Lab values of a result, each with its unit: "Leucocitos 3 10⁹/L · Glucosa 90 mg/dL". */
export function valuesText(result: SampleResult, lang: Language) {
  const sample = sampleOf(result.sample);
  return Object.entries(result.values ?? {})
    .map(([id, value]) => {
      const a = sample?.analytes.find((x) => x.id === id);
      return a ? `${a.name[lang]} ${value} ${a.unit}` : `${id} ${value}`;
    })
    .join(' · ');
}

function Block({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="flex flex-col gap-1.5">
      <h4 className="text-muted-foreground text-[11px] font-semibold tracking-wide uppercase">
        {title}
      </h4>
      <div className="flex flex-col gap-1 text-xs">{children}</div>
    </section>
  );
}

export function SampleFile({
  item,
  lang,
  t,
}: {
  item: PendingSample;
  lang: Language;
  t: ExtrasTexts;
}) {
  const sample = sampleOf(item.sample);
  if (!sample) return null;
  const module = sample.modules?.find((m) => m.id === item.module)?.name[lang] ?? item.module;
  const indicators = baseConfig().indicators;
  const answers = sample.questions.flatMap((q) => {
    const value = item.answers[q.id];
    const option = q.options.find((o) => o.id === value);
    return value ? [`${q.label[lang]} ${option?.label[lang] ?? value}`] : [];
  });

  return (
    <li className="flex flex-col gap-2 px-4 py-3" data-testid={`pending-${item.id}`}>
      <span className="text-sm">
        <span className="font-medium">{item.name}</span> · {sample.name[lang]}
        {module ? ` · ${format(t.moduleLabel, { module })}` : ''}
        <span className="text-muted-foreground">
          {' '}
          · {format(t.collectedOn, { date: dateText(item.collectedAt, lang) })} ·{' '}
          {item.age.days === 0 ? t.ageToday : format(t.ageDays, { n: item.age.days })}
        </span>
        {item.age.stale ? (
          <CircleAlert
            aria-label={format(t.staleWarning, { max: sample.maxAgeDays })}
            className="text-level-amber ml-1.5 inline size-3.5 align-[-2px]"
          />
        ) : null}
      </span>
      <Collapsible>
        <CollapsibleTrigger className="text-link self-start text-xs hover:underline">
          {t.fileOpen}
        </CollapsibleTrigger>
        <CollapsibleContent className="flex flex-col gap-4 pt-3">
          <div className="grid gap-4 md:grid-cols-3">
            <Block title={t.collectionTitle}>
              <span>
                {format(t.collectedDay, { day: item.day, date: dateText(item.collectedAt, lang) })}
              </span>
              {module ? <span>{format(t.moduleLabel, { module })}</span> : null}
              {answers.map((a) => (
                <span key={a}>{a}</span>
              ))}
              {item.comment ? (
                <span>
                  <span className="text-muted-foreground">{t.commentLabel}: </span>“{item.comment}”
                </span>
              ) : null}
              {item.age.stale ? (
                <span className="text-level-amber flex items-center gap-1">
                  <CircleAlert aria-hidden="true" className="size-3.5" />
                  {format(t.staleWarning, { max: sample.maxAgeDays })}
                </span>
              ) : null}
            </Block>
            <Block title={t.contextTitle}>
              {item.context.readings.length === 0 && item.context.symptoms.length === 0 ? (
                <span className="text-muted-foreground">{t.noContext}</span>
              ) : null}
              {item.context.readings.map((r) => {
                const indicator = indicators.find((i) => i.id === r.indicator);
                return (
                  <span key={r.indicator} className="tabular-nums">
                    {indicator?.name[lang] ?? r.indicator}: {r.value} {unitLabel(r.unit, lang)}
                    <span className="text-muted-foreground"> · {dateText(r.takenAt, lang)}</span>
                  </span>
                );
              })}
              {item.context.symptoms.length ? (
                <span>
                  <span className="text-muted-foreground">{t.symptomsLabel}: </span>
                  {item.context.symptoms.map((s) => symptomById(s)?.name[lang] ?? s).join(', ')}
                </span>
              ) : null}
            </Block>
            <Block title={t.historyTitle}>
              {item.history.length === 0 ? (
                <span className="text-muted-foreground">{t.noHistory}</span>
              ) : (
                item.history.slice(0, 5).map((r) => (
                  <span key={r.id} className="flex flex-col">
                    <span className="inline-flex items-center gap-1.5">
                      <LevelGlyph level={RESULT_LEVEL[r.result]} size={8} />
                      {dateText(r.collectedAt, lang)} · {resultLabel(r.result, t)}
                    </span>
                    {r.values ? (
                      <span className="text-muted-foreground pl-3.5 tabular-nums">
                        {valuesText(r, lang)}
                      </span>
                    ) : null}
                  </span>
                ))
              )}
            </Block>
          </div>
          <Block title={t.labTitle}>
            <SampleResultForm id={item.id} sample={item.sample} lang={lang} />
          </Block>
        </CollapsibleContent>
      </Collapsible>
    </li>
  );
}
