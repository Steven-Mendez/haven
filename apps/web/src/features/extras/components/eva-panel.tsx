import { eva, symptomById } from '@haven/core';
import { Brain, HeartPulse, Info, type LucideIcon, Moon, Thermometer } from 'lucide-react';
import { AgeLabel, EmptyState, Hint, levelLabel } from '@/components/haven';
import { Term } from '@/components/haven/term';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { format, type Language } from '@/lib/i18n';
import { cn } from '@/lib/utils';
import type { ExtrasTexts } from '../i18n';
import {
  EVA_CATEGORIES,
  type EvaCategory,
  type EvaReadiness,
  type EvaRow,
  readinessLevel,
} from '../logic/eva';
import { getEvaReadiness } from '../server';
import { CrewTable } from './crew-table';
import { CrewCell, crewHref, crewTableTexts, StatusPill, toneOf } from './panel-parts';

const READINESS: EvaReadiness[] = ['fit', 'review', 'unfit', 'no-data'];

const CATEGORY_ICON: Record<EvaCategory, LucideIcon> = {
  vitals: HeartPulse,
  cognition: Brain,
  sleep: Moon,
  environment: Thermometer,
};

const LEVEL_TEXT: Record<string, string> = {
  green: 'text-level-green',
  amber: 'text-level-amber',
  red: 'text-level-red',
};

const CATEGORY_TERM: Record<EvaCategory, string> = {
  vitals: 'vitals',
  cognition: 'cognitive-battery',
  sleep: 'sleep',
  environment: 'environment',
};

function readinessLabel(r: EvaReadiness, t: ExtrasTexts) {
  return { fit: t.fit, review: t.review, unfit: t.unfit, 'no-data': t.noData }[r];
}

function categoryLabel(c: EvaCategory, t: ExtrasTexts) {
  return {
    vitals: t.catVitals,
    cognition: t.catCognition,
    sleep: t.catSleep,
    environment: t.catEnvironment,
  }[c];
}

function checkText(row: EvaRow, lang: Language, t: ExtrasTexts) {
  const check = row.prep.check;
  if (!check) return t.checkNone;
  if (check.clear) return t.checkClear;
  return check.symptoms.map((s) => symptomById(s)?.name[lang] ?? s).join(', ');
}

function reasonText(row: EvaRow, t: ExtrasTexts) {
  if (row.prep.readiness === 'symptoms') return t.dcsReason;
  if (row.readiness === 'no-data') return row.noRecentData ? t.staleReason : t.noPackets;
  if (row.reasons.length === 0 && row.prep.readiness !== 'incomplete') return t.allGreen;
  const list = (level: (l: string) => boolean) =>
    row.reasons.filter((c) => level(row.categories[c])).map((c) => categoryLabel(c, t));
  const flagged = list((l) => l === 'amber' || l === 'red');
  const missing = list((l) => l === 'pending');
  return [
    flagged.join(', '),
    row.prep.readiness === 'incomplete' ? t.prebreatheReason : '',
    missing.length ? format(t.missing, { list: missing.join(', ').toLowerCase() }) : '',
  ]
    .filter(Boolean)
    .join(' · ');
}

/** The four categories as one segmented icon strip, each colored by its level. */
function Categories({ row, lang, t }: { row: EvaRow; lang: Language; t: ExtrasTexts }) {
  return (
    <ul className="bg-surface-elevated/60 inline-flex items-center divide-x rounded-md border">
      {EVA_CATEGORIES.map((c) => {
        const Icon = CATEGORY_ICON[c];
        const level = row.categories[c];
        const label = `${categoryLabel(c, t)}: ${levelLabel(level, lang)}`;
        return (
          <li key={c}>
            <Hint label={label} side="top">
              <span
                className={cn(
                  'flex size-7 items-center justify-center',
                  LEVEL_TEXT[level] ?? 'text-tertiary',
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

export async function EvaPanel({
  mission,
  lang,
  t,
}: {
  mission: string;
  lang: Language;
  t: ExtrasTexts;
}) {
  const data = await getEvaReadiness(mission);
  const rows = data?.rows ?? [];

  return (
    <div className="flex min-w-0 flex-col gap-3">
      {rows.length === 0 || !data ? (
        <EmptyState title={t.evaEmpty} description={t.evaEmptyDetail} />
      ) : (
        <CrewTable
          id="eva"
          testId="eva-table"
          title={
            <Term id="eva" lang={lang} plain>
              {t.evaTitle}
            </Term>
          }
          description={t.evaDescription}
          legend={
            <ul className="text-muted-foreground flex flex-wrap items-center gap-x-4 gap-y-1 text-xs">
              {EVA_CATEGORIES.map((c) => {
                const Icon = CATEGORY_ICON[c];
                return (
                  <li key={c} className="flex items-center gap-1.5">
                    <Icon aria-hidden="true" className="size-3.5" />
                    <Term id={CATEGORY_TERM[c]} lang={lang} plain>
                      {categoryLabel(c, t)}
                    </Term>
                  </li>
                );
              })}
            </ul>
          }
          groups={READINESS.map((r) => ({
            key: r,
            tone: toneOf(readinessLevel(r)),
            label: readinessLabel(r, t),
          }))}
          columns={[
            { label: t.astronaut },
            { label: t.readiness },
            { label: t.evaCategories },
            { label: t.prebreatheCol, className: 'whitespace-normal' },
            { label: t.checkCol, className: 'whitespace-normal' },
            {
              label: t.reasons,
              className: 'text-muted-foreground hidden whitespace-normal xl:table-cell',
            },
          ]}
          rows={rows.map((row) => {
            const pre = row.prep.prebreathe;
            const check = row.prep.check;
            return {
              id: row.id,
              name: row.name,
              group: row.readiness,
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
                <StatusPill key="readiness" tone={toneOf(readinessLevel(row.readiness))}>
                  {readinessLabel(row.readiness, t)}
                </StatusPill>,
                <Categories key="categories" row={row} lang={lang} t={t} />,
                <span key="pre" className="flex flex-col items-start gap-1">
                  <StatusPill tone={pre ? (pre.complete ? 'green' : 'amber') : 'muted'}>
                    {pre ? `${pre.minutes}/${pre.required} min` : t.prebreatheNone}
                  </StatusPill>
                  {pre ? (
                    <span className="text-muted-foreground">
                      {eva.methods.find((m) => m.id === pre.method)?.name[lang] ?? pre.method}
                    </span>
                  ) : null}
                </span>,
                <span key="check" className="flex flex-col items-start gap-1">
                  <StatusPill tone={check ? (check.clear ? 'green' : 'red') : 'muted'}>
                    {check ? (check.clear ? t.checkClear : t.checkSymptoms) : t.checkNone}
                  </StatusPill>
                  {check && !check.clear ? (
                    <span className="text-muted-foreground">{checkText(row, lang, t)}</span>
                  ) : null}
                </span>,
                reasonText(row, t),
              ],
            };
          })}
          summary={format(t.evaFooter, {
            fit: rows.filter((r) => r.readiness === 'fit').length,
            total: rows.length,
          })}
          texts={crewTableTexts(t)}
        />
      )}
      <Collapsible>
        <CollapsibleTrigger className="text-muted-foreground hover:text-foreground hit-area flex min-h-8 items-center gap-1.5 text-xs">
          <Info aria-hidden="true" className="size-3.5" />
          {t.howCalculated}
        </CollapsibleTrigger>
        <CollapsibleContent className="text-muted-foreground max-w-3xl pt-1 text-xs">
          {t.evaSource}
        </CollapsibleContent>
      </Collapsible>
    </div>
  );
}
