'use client';

import {
  Activity,
  Brain,
  Dumbbell,
  Globe,
  Heart,
  HeartPulse,
  Keyboard,
  type LucideIcon,
  MapPin,
  MousePointerClick,
  Pencil,
  Search,
  SearchX,
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
    const ZoneIcon = zoneIcons[i.zone] ?? Activity;
    const count = i.rules.length;
    const overrides = i.overrides.map((e) => environmentNames[e] ?? e);
    return (
      <TableRow
        key={i.id}
        className="group/row cursor-pointer"
        onClick={() => router.push(href)}
        data-indicator={i.id}
      >
        <TableCell className="py-3 pl-4 whitespace-normal group-hover/row:shadow-[inset_2px_0_0_var(--brand)]">
          <div className="flex items-center gap-3">
            <span
              aria-hidden="true"
              className="bg-surface-elevated text-muted-foreground group-hover/row:text-brand flex size-8 shrink-0 items-center justify-center rounded-lg border transition-colors"
            >
              <ZoneIcon className="size-4" />
            </span>
            <div className="flex min-w-0 flex-col gap-0.5">
              <span className="font-medium">
                <TermTip explanation={explanations?.[i.id]}>{name}</TermTip>
              </span>
              <span className="text-tertiary text-2xs">
                {i.unit || t.unitless}
                <span aria-hidden="true" className="mx-1.5">
                  ·
                </span>
                {count === 1 ? t.thresholdsOne : format(t.thresholdsMany, { n: String(count) })}
              </span>
            </div>
          </div>
        </TableCell>
        <TableCell>
          <ul
            className="bg-surface-elevated/60 inline-flex items-center divide-x rounded-md border"
            data-inputs={i.inputs.join(' ')}
          >
            {i.inputs.map((input) => {
              const { Icon, text } = inputIcons[input];
              return (
                <li key={input}>
                  <Hint label={t[text]} side="top">
                    <span className="text-muted-foreground hover:text-foreground flex size-7 items-center justify-center transition-colors">
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
                        'flex h-6 items-center justify-center rounded-md text-xs font-semibold',
                        n === 0
                          ? 'bg-brand-subtle text-link ring-brand/30 min-w-7 px-1.5 ring-1 ring-inset'
                          : 'text-tertiary w-5',
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
        <TableCell>
          <span
            className="inline-flex items-center gap-1.5 rounded-full py-0.5 pr-2.5 pl-2 text-xs tabular-nums"
            style={{
              background: 'color-mix(in oklab, var(--scale-green) 12%, transparent)',
            }}
          >
            <span
              aria-hidden="true"
              className="size-1.5 rounded-full"
              style={{ background: 'var(--scale-green)' }}
            />
            <span className="text-foreground font-medium">
              {i.green[0]}–{i.green[1]}
            </span>
            {i.unit ? <span className="text-muted-foreground">{i.unit}</span> : null}
          </span>
        </TableCell>
        <TableCell className="py-3">
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
        <TableCell className="hidden lg:table-cell">
          {overrides.length ? (
            <Hint
              label={format(t.scopeOverrides, { environments: overrides.join(', ') })}
              side="top"
            >
              <span className="border-brand/30 bg-brand-subtle text-link inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-xs">
                <MapPin aria-hidden="true" className="size-3" />
                {overrides.length === 1
                  ? t.environmentsOne
                  : format(t.environmentsMany, { n: String(overrides.length) })}
                <span className="sr-only">
                  {format(t.scopeOverrides, { environments: overrides.join(', ') })}
                </span>
              </span>
            </Hint>
          ) : (
            <span className="text-muted-foreground inline-flex items-center gap-1.5 text-xs">
              <Globe aria-hidden="true" className="text-tertiary size-3.5" />
              {t.scopeAll}
            </span>
          )}
        </TableCell>
        <TableCell className="pr-3 text-right">
          <Hint label={`${t.edit} · ${name}`} side="left">
            <Link
              href={href}
              className={cn(
                buttonVariants({ variant: 'ghost', size: 'icon-sm' }),
                'hit-area text-tertiary group-hover/row:text-foreground group-hover/row:bg-hover',
              )}
              aria-label={`${t.edit} · ${name}`}
              onClick={(e) => e.stopPropagation()}
            >
              <Pencil className="transition-opacity" />
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
                  className="group/tab data-active:[&_svg]:text-brand flex-none"
                >
                  <Icon aria-hidden="true" />
                  {g.name}
                  <span className="bg-muted text-muted-foreground group-data-active/tab:bg-brand-subtle group-data-active/tab:text-link text-2xs rounded-full px-1.5 font-medium tabular-nums">
                    {g.items.length}
                  </span>
                </TabsTrigger>
              );
            })}
          </TabsList>
        </Tabs>
      ) : null}

      <div className="bg-card overflow-hidden rounded-xl border shadow-xs">
        <Table data-testid="rules-thresholds">
          <TableHeader className="bg-surface/60">
            <TableRow className="[&>th]:text-2xs [&>th]:h-9 [&>th]:tracking-wider [&>th]:uppercase">
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
              <TableRow className="hover:bg-transparent">
                <TableCell colSpan={7} className="h-28 text-center">
                  <div className="text-muted-foreground flex flex-col items-center gap-2">
                    <SearchX aria-hidden="true" className="text-tertiary size-5" />
                    {t.noMatches}
                  </div>
                </TableCell>
              </TableRow>
            ) : null}
          </TableBody>
        </Table>
        {active ? (
          <div className="bg-surface/40 text-tertiary flex items-center justify-between gap-3 border-t px-4 py-2 text-xs">
            <span className="tabular-nums">
              {format(t.tableFooter, {
                shown: String(active.items.length),
                total: String(indicators.length),
              })}
            </span>
            <span className="hidden items-center gap-1.5 sm:inline-flex">
              <MousePointerClick aria-hidden="true" className="size-3.5" />
              {t.tableFooterHint}
            </span>
          </div>
        ) : null}
      </div>
    </section>
  );
}
