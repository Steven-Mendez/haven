'use client';

import { MousePointerClick, Search, SearchX, Users } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { type MouseEvent, type ReactNode, useState } from 'react';
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
import { cn } from '@/lib/utils';

// The crew tables of the countermeasure tabs, built like the Indicators table:
// a heading with a count and a filter, line tabs with counts that group the
// rows by state, rows that open the crew member's page, an empty state for
// the filter and a footer with what is shown and how to use it.

export type CrewTableTone = 'green' | 'amber' | 'red' | 'muted';

export type CrewTableGroup = { key: string; label: string; tone?: CrewTableTone };

export type CrewTableColumn = { label: ReactNode; className?: string };

export type CrewTableRow = {
  id: string;
  /** Text the filter searches. */
  name: string;
  /** Group key of the row's state, matched against `groups`. */
  group: string;
  /** Where a click on the row goes; interactive cells keep their own behavior. */
  href?: string;
  cells: ReactNode[];
};

export type CrewTableTexts = {
  filter: string;
  all: string;
  noMatches: string;
  /** "{shown} de {total} tripulantes". */
  footer: string;
  footerHint: string;
};

const TONE_COLOR: Record<Exclude<CrewTableTone, 'muted'>, string> = {
  green: 'var(--scale-green)',
  amber: 'var(--scale-amber)',
  red: 'var(--scale-red)',
};

const fill = (s: string, vars: Record<string, string | number>) =>
  s.replace(/\{(\w+)\}/g, (m, k) => (k in vars ? String(vars[k]) : m));

/** A click on a link, a button, a field or anything rendered in a portal is not a row click. */
function rowClick(event: MouseEvent<HTMLTableRowElement>) {
  const target = event.target as HTMLElement;
  if (!event.currentTarget.contains(target)) return false;
  return !target.closest('a, button, input, select, textarea, label, [role="dialog"]');
}

export function CrewTable({
  id,
  title,
  description,
  legend,
  aside,
  groups,
  columns,
  rows,
  summary,
  texts,
  testId,
}: {
  id: string;
  title: ReactNode;
  description?: ReactNode;
  /** Small legend under the description, as the Indicators scale. */
  legend?: ReactNode;
  /** Extra content at the right of the heading, before the filter. */
  aside?: ReactNode;
  groups: CrewTableGroup[];
  columns: CrewTableColumn[];
  rows: CrewTableRow[];
  /** Domain summary shown in the footer after the count. */
  summary?: ReactNode;
  texts: CrewTableTexts;
  testId?: string;
}) {
  const router = useRouter();
  const [query, setQuery] = useState('');
  const [selected, setSelected] = useState('all');
  const q = query.trim().toLowerCase();
  const matching = q ? rows.filter((r) => r.name.toLowerCase().includes(q)) : rows;
  const tabs = [
    { key: 'all', label: texts.all, tone: undefined, all: true, count: matching.length },
    ...groups.map((g) => ({
      ...g,
      all: false,
      count: matching.filter((r) => r.group === g.key).length,
    })),
  ];
  const active = tabs.some((t) => t.key === selected) ? selected : 'all';
  const shown = active === 'all' ? matching : matching.filter((r) => r.group === active);

  return (
    <section aria-labelledby={id} className="flex min-w-0 flex-col gap-2">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="flex min-w-0 flex-col gap-0.5">
          <h2 id={id} className="text-sm font-semibold">
            {title}
            <span className="text-tertiary ml-2 font-normal tabular-nums">{rows.length}</span>
          </h2>
          {description ? <p className="text-muted-foreground text-xs">{description}</p> : null}
          {legend ? <div className="mt-1.5">{legend}</div> : null}
        </div>
        <div className="flex w-full flex-wrap items-center justify-end gap-3 sm:w-auto">
          {aside}
          <div className="relative w-full sm:w-64">
            <Search
              aria-hidden="true"
              className="text-tertiary pointer-events-none absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2"
            />
            <Input
              type="search"
              aria-label={texts.filter}
              placeholder={texts.filter}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="pl-8"
            />
          </div>
        </div>
      </div>

      <Tabs value={active} onValueChange={(v) => setSelected(String(v))} className="mt-2">
        <TabsList variant="line" className="h-auto max-w-full flex-wrap justify-start">
          {tabs.map((tab) => {
            const color = tab.tone && tab.tone !== 'muted' ? TONE_COLOR[tab.tone] : undefined;
            return (
              <TabsTrigger
                key={tab.key}
                value={tab.key}
                data-group={tab.key}
                className="group/tab data-active:[&_svg]:text-brand flex-none"
              >
                {tab.all ? (
                  <Users aria-hidden="true" />
                ) : (
                  <span
                    aria-hidden="true"
                    className="size-2 rounded-full"
                    style={{ background: color ?? 'var(--muted-foreground)' }}
                  />
                )}
                {tab.label}
                <span className="bg-muted text-muted-foreground group-data-active/tab:bg-brand-subtle group-data-active/tab:text-link text-2xs rounded-full px-1.5 font-medium tabular-nums">
                  {tab.count}
                </span>
              </TabsTrigger>
            );
          })}
        </TabsList>
      </Tabs>

      <div className="bg-card overflow-hidden rounded-xl border shadow-xs">
        <Table data-testid={testId}>
          <TableHeader className="bg-surface/60">
            <TableRow className="[&>th]:text-2xs [&>th]:h-9 [&>th]:tracking-wider [&>th]:uppercase">
              {columns.map((c, n) => (
                <TableHead
                  // biome-ignore lint/suspicious/noArrayIndexKey: fixed columns of the table
                  key={n}
                  className={cn(n === 0 && 'pl-4', n === columns.length - 1 && 'pr-4', c.className)}
                >
                  {c.label}
                </TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {shown.map((row) => (
              <TableRow
                key={row.id}
                data-row={row.id}
                className={cn('group/row align-top', row.href && 'cursor-pointer')}
                onClick={(e) => {
                  if (row.href && rowClick(e)) router.push(row.href);
                }}
              >
                {row.cells.map((cell, n) => (
                  <TableCell
                    // biome-ignore lint/suspicious/noArrayIndexKey: one cell per column
                    key={n}
                    className={cn(
                      'py-3',
                      n === 0
                        ? 'pl-4 whitespace-normal group-hover/row:shadow-[inset_2px_0_0_var(--brand)]'
                        : 'text-xs',
                      n === row.cells.length - 1 && 'pr-3',
                      columns[n]?.className,
                    )}
                  >
                    {cell}
                  </TableCell>
                ))}
              </TableRow>
            ))}
            {shown.length === 0 ? (
              <TableRow className="hover:bg-transparent">
                <TableCell colSpan={columns.length} className="h-28 text-center">
                  <div className="text-muted-foreground flex flex-col items-center gap-2">
                    <SearchX aria-hidden="true" className="text-tertiary size-5" />
                    {texts.noMatches}
                  </div>
                </TableCell>
              </TableRow>
            ) : null}
          </TableBody>
        </Table>
        <div className="bg-surface/40 text-tertiary flex flex-wrap items-center justify-between gap-3 border-t px-4 py-2 text-xs">
          <span className="tabular-nums">
            {fill(texts.footer, { shown: shown.length, total: rows.length })}
            {summary ? (
              <>
                <span aria-hidden="true" className="mx-1.5">
                  ·
                </span>
                {summary}
              </>
            ) : null}
          </span>
          <span className="hidden items-center gap-1.5 sm:inline-flex">
            <MousePointerClick aria-hidden="true" className="size-3.5" />
            {texts.footerHint}
          </span>
        </div>
      </div>
    </section>
  );
}
