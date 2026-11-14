import { Info } from 'lucide-react';
import {
  AgeLabel,
  EmptyState,
  LevelBadge,
  LevelGlyph,
  levelLabel,
  Section,
} from '@/components/haven';
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

const READINESS: EvaReadiness[] = ['fit', 'review', 'unfit', 'no-data'];

/** Glossary id explaining each EVA category header. */
const CATEGORY_TERM: Record<EvaCategory, string> = {
  heart: 'heart',
  lungs: 'lungs',
  cognition: 'cognitive-battery',
  sleep: 'sleep',
};

function readinessLabel(r: EvaReadiness, t: ExtrasTexts) {
  return { fit: t.fit, review: t.review, unfit: t.unfit, 'no-data': t.noData }[r];
}

function categoryLabel(c: EvaCategory, t: ExtrasTexts) {
  return { heart: t.catHeart, lungs: t.catLungs, cognition: t.catCognition, sleep: t.catSleep }[c];
}

function reasonText(row: EvaRow, t: ExtrasTexts) {
  if (row.readiness === 'no-data') return row.noRecentData ? t.staleReason : t.noPackets;
  if (row.reasons.length === 0) return t.allGreen;
  const list = (level: (l: string) => boolean) =>
    row.reasons.filter((c) => level(row.categories[c])).map((c) => categoryLabel(c, t));
  const flagged = list((l) => l === 'amber' || l === 'red');
  const missing = list((l) => l === 'pending');
  return [
    flagged.join(', '),
    missing.length ? format(t.missing, { list: missing.join(', ').toLowerCase() }) : '',
  ]
    .filter(Boolean)
    .join(' · ');
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
  const counts = Object.fromEntries(
    READINESS.map((r) => [r, rows.filter((x) => x.readiness === r).length]),
  ) as Record<EvaReadiness, number>;

  return (
    <Section
      title={
        <Term id="eva" lang={lang}>
          {t.evaTitle}
        </Term>
      }
      description={t.evaDescription}
    >
      {rows.length === 0 || !data ? (
        <EmptyState title={t.evaEmpty} description={t.evaEmptyDetail} />
      ) : (
        <>
          <dl
            className="bg-border grid grid-cols-2 gap-px overflow-hidden rounded-xl border sm:grid-cols-4"
            aria-label={t.readiness}
          >
            {READINESS.map((r) => (
              <div key={r} className="bg-background md:bg-surface flex flex-col gap-1.5 px-4 py-3">
                <dt className="text-muted-foreground flex items-center gap-1.5 text-xs">
                  <LevelGlyph
                    level={readinessLevel({ readiness: r, noRecentData: false })}
                    size={10}
                  />
                  {readinessLabel(r, t)}
                </dt>
                <dd className="text-[28px] leading-8 font-medium tracking-[-0.02em] tabular-nums">
                  {counts[r]}
                  <span className="text-tertiary ml-1 text-sm font-normal">/ {rows.length}</span>
                </dd>
              </div>
            ))}
          </dl>
          <div className="overflow-hidden rounded-xl border">
            <Table data-testid="eva-table">
              <TableHeader>
                <TableRow>
                  <TableHead className="pl-4">{t.astronaut}</TableHead>
                  <TableHead>{t.readiness}</TableHead>
                  {EVA_CATEGORIES.map((c) => (
                    <TableHead key={c}>
                      <Term id={CATEGORY_TERM[c]} lang={lang}>
                        {categoryLabel(c, t)}
                      </Term>
                    </TableHead>
                  ))}
                  <TableHead>{t.reasons}</TableHead>
                  <TableHead className="pr-4">{t.lastData}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((row) => (
                  <TableRow key={row.id}>
                    <TableCell className="pl-4 font-medium">{row.name}</TableCell>
                    <TableCell>
                      <LevelBadge
                        level={readinessLevel(row)}
                        lang={lang}
                        label={readinessLabel(row.readiness, t)}
                      />
                    </TableCell>
                    {EVA_CATEGORIES.map((c) => (
                      <TableCell key={c}>
                        <span
                          className={cn(
                            'inline-flex items-center gap-1.5 text-xs',
                            row.noRecentData || row.categories[c] === 'pending'
                              ? 'text-muted-foreground'
                              : 'text-foreground',
                          )}
                        >
                          <LevelGlyph
                            level={row.categories[c]}
                            size={10}
                            muted={row.noRecentData}
                          />
                          {levelLabel(row.categories[c], lang)}
                        </span>
                      </TableCell>
                    ))}
                    <TableCell className="text-muted-foreground text-xs whitespace-normal">
                      {reasonText(row, t)}
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
    </Section>
  );
}
