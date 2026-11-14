'use client';

import { Pencil, Search, X } from 'lucide-react';
import { useState } from 'react';
import { Hint, levelLabel, type TermExplanation, TermTip } from '@/components/haven';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { format, type Language, textsFor, translate } from '@/lib/i18n';
import { texts } from '../i18n';
import type { EditableIndicator } from '../logic/rules';
import { RangeScale } from './range-scale';
import { RulesEditor } from './rules-editor';

type Props = {
  lang: Language;
  indicators: EditableIndicator[];
  currentVersion: string;
  environmentNames: Record<string, string>;
  defaultAuthor: string;
  /** Indicator id → glossary explanation (resolved on the server). */
  explanations?: Record<string, TermExplanation | undefined>;
  /** Glossary explanation of «normal range». */
  rangeExplain?: TermExplanation;
};

const range = (r: [number, number], unit: string) => `${r[0]}–${r[1]}${unit ? ` ${unit}` : ''}`;

/**
 * Thresholds in force as one compact table (SPEC §6 «Reglas de umbral», Mercury rules): Metric · Normal
 * range · level scale by value (RangeScale) · Scope. Opening a row shows the editor in a 480 px right sheet (incident.io
 * expression builder) that sends a new version. Same editor and server action as before.
 */
export function RulesTable({
  lang,
  indicators,
  currentVersion,
  environmentNames,
  defaultAuthor,
  explanations,
  rangeExplain,
}: Props) {
  const t = textsFor(texts, lang);
  const [open, setOpen] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const q = query.trim().toLowerCase();
  const shown = q
    ? indicators.filter((i) => translate(i.name, lang).toLowerCase().includes(q))
    : indicators;
  const current = indicators.find((i) => i.id === open);
  const scaleTexts = {
    below: t.scaleBelow,
    above: t.scaleAbove,
    between: t.scaleBetween,
    withSymptoms: t.scaleWithSymptoms,
    levels: {
      green: levelLabel('green', lang),
      amber: levelLabel('amber', lang),
      red: levelLabel('red', lang),
    },
  };

  return (
    <section aria-labelledby="thresholds" className="flex min-w-0 flex-col gap-2">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="flex flex-col gap-0.5">
          <h2 id="thresholds" className="text-sm font-semibold">
            {t.thresholdsTitle}
            <span className="text-tertiary ml-2 font-normal tabular-nums">{indicators.length}</span>
          </h2>
          <p className="text-muted-foreground text-xs">
            {format(t.thresholdsDescription, { version: currentVersion })}
          </p>
          <ul className="text-muted-foreground mt-1.5 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs">
            {(['green', 'amber', 'red'] as const).map((level) => (
              <li key={level} className="flex items-center gap-1.5">
                <span
                  aria-hidden="true"
                  className="h-2 w-4 rounded-full"
                  style={{ background: `var(--level-${level})` }}
                />
                {levelLabel(level, lang)}
              </li>
            ))}
            <li className="flex items-center gap-1.5">
              <span
                aria-hidden="true"
                className="h-2 w-4 rounded-full"
                style={{
                  background:
                    'repeating-linear-gradient(135deg, var(--level-red) 0 3px, var(--level-amber) 3px 6px)',
                }}
              />
              {t.legendSymptoms}
            </li>
          </ul>
        </div>
        <div className="relative w-full sm:w-64">
          <Search
            aria-hidden="true"
            className="text-tertiary pointer-events-none absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2"
          />
          <Input
            type="search"
            aria-label={t.filterIndicators}
            placeholder={t.filterIndicators}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="pl-8"
          />
        </div>
      </div>

      <div className="overflow-hidden rounded-xl border">
        <Table data-testid="rules-thresholds">
          <TableHeader>
            <TableRow>
              <TableHead className="pl-4">{t.indicator}</TableHead>
              <TableHead>
                <TermTip explanation={rangeExplain}>{t.greenRange}</TermTip>
              </TableHead>
              <TableHead>{t.colCondition}</TableHead>
              <TableHead className="hidden lg:table-cell">{t.colScope}</TableHead>
              <TableHead className="w-12 pr-4">
                <span className="sr-only">{t.edit}</span>
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {shown.map((i) => {
              const name = translate(i.name, lang);
              return (
                <TableRow
                  key={i.id}
                  className="cursor-pointer"
                  onClick={() => setOpen(i.id)}
                  data-indicator={i.id}
                >
                  <TableCell className="pl-4 font-medium whitespace-normal">
                    <TermTip explanation={explanations?.[i.id]}>{name}</TermTip>
                  </TableCell>
                  <TableCell className="text-muted-foreground tabular-nums">
                    {range(i.green, i.unit)}
                  </TableCell>
                  <TableCell className="py-2.5">
                    {i.rules.length ? (
                      <RangeScale
                        indicator={i}
                        texts={scaleTexts}
                        label={i.rules
                          .map(
                            (r) =>
                              `${levelLabel(r.level, lang)}: ${format(t.outsideRange, { range: range(r.outside, i.unit) })}${r.withSymptoms ? ` (${t.withSymptoms})` : ''}`,
                          )
                          .join('; ')}
                      />
                    ) : (
                      <span className="text-tertiary text-xs">—</span>
                    )}
                  </TableCell>
                  <TableCell className="text-muted-foreground hidden max-w-56 text-xs whitespace-normal lg:table-cell">
                    {i.overrides.length
                      ? format(t.scopeOverrides, {
                          environments: i.overrides.map((e) => environmentNames[e] ?? e).join(', '),
                        })
                      : t.scopeAll}
                  </TableCell>
                  <TableCell className="pr-4 text-right">
                    <Hint label={`${t.edit} · ${name}`} side="left">
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon-sm"
                        className="hit-area"
                        aria-label={`${t.edit} · ${name}`}
                        onClick={(e) => {
                          e.stopPropagation();
                          setOpen(i.id);
                        }}
                      >
                        <Pencil />
                      </Button>
                    </Hint>
                  </TableCell>
                </TableRow>
              );
            })}
            {shown.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="text-muted-foreground h-16 text-center">
                  {t.noMatches}
                </TableCell>
              </TableRow>
            ) : null}
          </TableBody>
        </Table>
      </div>

      <Sheet open={Boolean(open)} onOpenChange={(next) => (next ? null : setOpen(null))}>
        <SheetContent
          side="right"
          showCloseButton={false}
          className="gap-0 rounded-l-2xl p-0 data-[side=right]:w-full data-[side=right]:sm:max-w-[480px]"
        >
          <SheetHeader className="flex-row items-start justify-between gap-3 border-b px-4 py-3">
            <div className="flex flex-col gap-0.5">
              <SheetTitle className="text-sm font-semibold">
                {t.editorTitle}
                {current ? (
                  <span className="text-muted-foreground font-normal">
                    {' · '}
                    {translate(current.name, lang)}
                  </span>
                ) : null}
              </SheetTitle>
              <SheetDescription className="text-xs">
                {format(t.editorDescription, { version: currentVersion })}
              </SheetDescription>
            </div>
            <Hint label={t.close} kbd="esc" side="left">
              <SheetClose
                render={
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    className="hit-area"
                    aria-label={t.close}
                  />
                }
              >
                <X />
              </SheetClose>
            </Hint>
          </SheetHeader>
          {current ? (
            <RulesEditor
              key={current.id}
              lang={lang}
              indicators={indicators}
              currentVersion={currentVersion}
              environmentNames={environmentNames}
              defaultAuthor={defaultAuthor}
              initialIndicator={current.id}
              bare
            />
          ) : null}
        </SheetContent>
      </Sheet>
    </section>
  );
}
