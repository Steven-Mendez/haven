import { eva, symptomById } from '@haven/core';
import { Brain, HeartPulse, Info, type LucideIcon, Moon, Thermometer } from 'lucide-react';
import { AgeLabel, EmptyState, Hint, levelLabel } from '@/components/haven';
import { Term } from '@/components/haven/term';
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
import type { ExtrasTexts } from '../i18n';
import {
  EVA_CATEGORIES,
  type EvaCategory,
  type EvaReadiness,
  type EvaRow,
  readinessLevel,
} from '../logic/eva';
import { getEvaReadiness } from '../server';
import {
  CrewCell,
  PanelHeading,
  panelTable,
  StatusPill,
  SummaryChips,
  toneOf,
} from './panel-parts';

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
                  row.noRecentData ? 'text-tertiary' : (LEVEL_TEXT[level] ?? 'text-tertiary'),
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
    <section aria-labelledby="eva" className="flex min-w-0 flex-col gap-3">
      <PanelHeading
        id="eva"
        title={
          <Term id="eva" lang={lang}>
            {t.evaTitle}
          </Term>
        }
        count={rows.length || undefined}
        description={t.evaDescription}
      >
        <ul className="text-muted-foreground flex flex-wrap items-center gap-x-4 gap-y-1 text-xs">
          {EVA_CATEGORIES.map((c) => {
            const Icon = CATEGORY_ICON[c];
            return (
              <li key={c} className="flex items-center gap-1.5">
                <Icon aria-hidden="true" className="size-3.5" />
                <Term id={CATEGORY_TERM[c]} lang={lang}>
                  {categoryLabel(c, t)}
                </Term>
              </li>
            );
          })}
        </ul>
      </PanelHeading>
      {rows.length === 0 || !data ? (
        <EmptyState title={t.evaEmpty} description={t.evaEmptyDetail} />
      ) : (
        <>
          <SummaryChips
            label={t.readiness}
            items={READINESS.map((r) => ({
              key: r,
              tone: toneOf(readinessLevel({ readiness: r, noRecentData: false })),
              label: readinessLabel(r, t),
              count: rows.filter((x) => x.readiness === r).length,
            }))}
          />
          <div className={panelTable.card}>
            <Table data-testid="eva-table">
              <TableHeader className={panelTable.header}>
                <TableRow className={panelTable.headRow}>
                  <TableHead className="pl-4">{t.astronaut}</TableHead>
                  <TableHead>{t.readiness}</TableHead>
                  <TableHead>{t.evaCategories}</TableHead>
                  <TableHead>{t.prebreatheCol}</TableHead>
                  <TableHead>{t.checkCol}</TableHead>
                  <TableHead className="hidden pr-4 xl:table-cell">{t.reasons}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((row) => {
                  const pre = row.prep.prebreathe;
                  const check = row.prep.check;
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
                        <StatusPill tone={toneOf(readinessLevel(row))}>
                          {readinessLabel(row.readiness, t)}
                        </StatusPill>
                      </TableCell>
                      <TableCell className="py-3">
                        <Categories row={row} lang={lang} t={t} />
                      </TableCell>
                      <TableCell className="py-3 text-xs whitespace-normal">
                        <StatusPill tone={pre ? (pre.complete ? 'green' : 'amber') : 'muted'}>
                          {pre ? `${pre.minutes}/${pre.required} min` : t.prebreatheNone}
                        </StatusPill>
                        {pre ? (
                          <span className="text-muted-foreground mt-1 block">
                            {eva.methods.find((m) => m.id === pre.method)?.name[lang] ?? pre.method}
                          </span>
                        ) : null}
                      </TableCell>
                      <TableCell className="py-3 text-xs whitespace-normal">
                        <StatusPill tone={check ? (check.clear ? 'green' : 'red') : 'muted'}>
                          {check ? (check.clear ? t.checkClear : t.checkSymptoms) : t.checkNone}
                        </StatusPill>
                        {check && !check.clear ? (
                          <span className="text-muted-foreground mt-1 block">
                            {checkText(row, lang, t)}
                          </span>
                        ) : null}
                      </TableCell>
                      <TableCell className="text-muted-foreground hidden py-3 pr-4 text-xs whitespace-normal xl:table-cell">
                        {reasonText(row, t)}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
            <div className={panelTable.footer}>
              <span className="tabular-nums">
                {format(t.evaFooter, {
                  fit: rows.filter((r) => r.readiness === 'fit').length,
                  total: rows.length,
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
          {t.evaSource}
        </CollapsibleContent>
      </Collapsible>
    </section>
  );
}
