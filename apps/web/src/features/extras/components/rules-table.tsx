'use client';

import {
  Activity,
  Brain,
  Dumbbell,
  Heart,
  HeartPulse,
  Keyboard,
  type LucideIcon,
  Pencil,
  Search,
  Smartphone,
  SmilePlus,
  Thermometer,
  Timer,
  Utensils,
  Watch,
} from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { Hint, type TermExplanation, TermTip } from '@/components/haven';
import { buttonVariants } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { format, type Language, textsFor, translate } from '@/lib/i18n';
import { cn } from '@/lib/utils';
import { texts } from '../i18n';
import type { EditableIndicator } from '../logic/rules';
import { RangeScale } from './range-scale';

type Props = {
  lang: Language;
  indicators: EditableIndicator[];
  zones: { id: string; name: string }[];
  currentVersion: string;
  environmentNames: Record<string, string>;
  explanations?: Record<string, TermExplanation | undefined>;
};

const zoneIcons: Record<string, LucideIcon> = {
  vitals: HeartPulse,
  mind: Brain,
  performance: Dumbbell,
  metabolism: Utensils,
  environment: Thermometer,
};

const inputIcons = {
  watch: { Icon: Watch, text: 'inputWatch' },
  health: { Icon: Heart, text: 'inputHealth' },
  phone: { Icon: Smartphone, text: 'inputPhone' },
  test: { Icon: Timer, text: 'inputTest' },
  'check-in': { Icon: SmilePlus, text: 'inputCheckIn' },
  manual: { Icon: Keyboard, text: 'inputManual' },
} as const;

const ridgeHazards = {
  radiation: { letter: 'R', text: 'ridgeRadiation' },
  isolation: { letter: 'I', text: 'ridgeIsolation' },
  distance: { letter: 'D', text: 'ridgeDistance' },
  gravity: { letter: 'G', text: 'ridgeGravity' },
  environment: { letter: 'E', text: 'ridgeEnvironment' },
} as const;

const range = (r: [number, number], unit: string) => `${r[0]}–${r[1]}${unit ? ` ${unit}` : ''}`;

export function RulesTable({
  lang,
  indicators,
  zones,
  currentVersion,
  environmentNames,
  explanations,
}: Props) {
  const t = textsFor(texts, lang);
  const router = useRouter();
  const [query, setQuery] = useState('');
  const q = query.trim().toLowerCase();
  const shown = q
    ? indicators.filter((i) => translate(i.name, lang).toLowerCase().includes(q))
    : indicators;
  const known = new Set(zones.map((z) => z.id));
  const groups = [
    ...zones.map((z) => ({ ...z, items: shown.filter((i) => i.zone === z.id) })),
    { id: '', name: t.otherCategory, items: shown.filter((i) => !known.has(i.zone)) },
  ].filter((g) => g.items.length > 0);
  const [selected, setSelected] = useState<string>();
  const active = groups.find((g) => g.id === selected) ?? groups[0];
  const scaleLevels = { green: t.scaleGreen, amber: t.scaleAmber, red: t.scaleRed };
  const scaleTexts = {
    below: t.scaleBelow,
    above: t.scaleAbove,
    between: t.scaleBetween,
    levels: scaleLevels,
  };

  const row = (i: EditableIndicator) => {
    const name = translate(i.name, lang);
    const href = `/rules/${encodeURIComponent(i.id)}`;
    return (
      <TableRow
        key={i.id}
        className="cursor-pointer"
        onClick={() => router.push(href)}
        data-indicator={i.id}
      >
        <TableCell className="pl-4 font-medium whitespace-normal">
          <TermTip explanation={explanations?.[i.id]}>{name}</TermTip>
        </TableCell>
        <TableCell>
          <ul className="flex items-center gap-1.5" data-inputs={i.inputs.join(' ')}>
            {i.inputs.map((input) => {
              const { Icon, text } = inputIcons[input];
              return (
                <li key={input}>
                  <Hint label={t[text]} side="top">
                    <span className="text-muted-foreground flex size-6 items-center justify-center rounded-md border">
                      <Icon aria-hidden="true" className="size-3.5" />
                      <span className="sr-only">{t[text]}</span>
                    </span>
                  </Hint>
                </li>
              );
            })}
          </ul>
        </TableCell>
        <TableCell>
          <ul className="flex items-center gap-1" data-ridge={i.ridge.join(' ')}>
            {i.ridge.map((hazard, n) => {
              const { letter, text } = ridgeHazards[hazard];
              const label = n === 0 ? `${t[text]} (${t.ridgeMain})` : t[text];
              return (
                <li key={hazard}>
                  <Hint label={label} side="top">
                    <span
                      className={cn(
                        'flex size-6 items-center justify-center rounded-md border text-xs font-semibold',
                        n === 0
                          ? 'bg-foreground text-background border-foreground'
                          : 'text-muted-foreground',
                      )}
                    >
                      <span aria-hidden="true">{letter}</span>
                      <span className="sr-only">{label}</span>
                    </span>
                  </Hint>
                </li>
              );
            })}
          </ul>
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
                    `${scaleLevels[r.level]}: ${format(t.outsideRange, { range: range(r.outside, i.unit) })}${r.withSymptoms ? ` (${t.withSymptoms})` : ''}`,
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
            <Link
              href={href}
              className={cn(buttonVariants({ variant: 'ghost', size: 'icon-sm' }), 'hit-area')}
              aria-label={`${t.edit} · ${name}`}
              onClick={(e) => e.stopPropagation()}
            >
              <Pencil />
            </Link>
          </Hint>
        </TableCell>
      </TableRow>
    );
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
                  style={{ background: `var(--scale-${level})` }}
                />
                {scaleLevels[level]}
              </li>
            ))}
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

      {groups.length > 0 ? (
        <Tabs value={active?.id} onValueChange={(v) => setSelected(String(v))} className="mt-2">
          <TabsList variant="line" className="h-auto max-w-full flex-wrap justify-start">
            {groups.map((g) => {
              const Icon = zoneIcons[g.id] ?? Activity;
              return (
                <TabsTrigger
                  key={g.id || 'other'}
                  value={g.id}
                  data-zone={g.id}
                  className="flex-none"
                >
                  <Icon aria-hidden="true" />
                  {g.name}
                  <span className="text-tertiary font-normal tabular-nums">{g.items.length}</span>
                </TabsTrigger>
              );
            })}
          </TabsList>
        </Tabs>
      ) : null}

      <div className="overflow-hidden rounded-xl border">
        <Table data-testid="rules-thresholds">
          <TableHeader>
            <TableRow>
              <TableHead className="pl-4">{t.indicator}</TableHead>
              <TableHead>{t.colInput}</TableHead>
              <TableHead>{t.colRidge}</TableHead>
              <TableHead>{t.greenRange}</TableHead>
              <TableHead>{t.colCondition}</TableHead>
              <TableHead className="hidden lg:table-cell">{t.colScope}</TableHead>
              <TableHead className="w-12 pr-4">
                <span className="sr-only">{t.edit}</span>
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {active?.items.map(row)}
            {shown.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="text-muted-foreground h-16 text-center">
                  {t.noMatches}
                </TableCell>
              </TableRow>
            ) : null}
          </TableBody>
        </Table>
      </div>
    </section>
  );
}
