'use client';

import type { Level } from '@haven/core';
import { useState } from 'react';
import { LevelBadge, SeriesChart, type TermExplanation } from '@/components/haven';
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { format, type Language } from '@/lib/i18n';

/** One selectable indicator, already prepared on the server (serialisable). */
export type TrendOption = {
  id: string;
  name: string;
  zone: string;
  zoneName: string;
  unit: string;
  level?: Level;
  points: [number, number][];
  baseline?: { median: number; range: [number, number] };
  /** Drawn on the chart when it does not flatten the line. */
  normalRange?: [number, number];
  /** Always given as text. */
  green?: [number, number];
  decimals: number;
  /** `bar` for daily counts (steps, sleep…), `line` otherwise. */
  kind?: 'line' | 'bar';
  /** Plain-language explanation of the indicator (shared glossary). */
  explain?: TermExplanation;
  /** What the current level means (glossary `level-*`). */
  levelMeaning?: TermExplanation;
  /** Glossary for the chart header: baseline, reference range, «now». */
  glossary?: { baseline?: TermExplanation; reference?: TermExplanation; now?: TermExplanation };
};

type Props = {
  options: TrendOption[];
  defaultId: string;
  /** Earth «now» (epoch ms): dashed line and hatched gap since the last reading. */
  nowAt?: number;
  lang: Language;
  texts: { indicator: string; normalRangeText: string; pointsCount: string; nowEarth?: string };
};

/** Trend of one indicator at a time, with an indicator selector grouped by zone (ref. Bevel, LangChain). */
export function TrendsPanel({ options, defaultId, nowAt, lang, texts }: Props) {
  const [selected, setSelected] = useState(defaultId);
  const current = options.find((o) => o.id === selected) ?? options[0];
  if (!current) return null;

  const zones = [...new Set(options.map((o) => o.zone))];
  const items = options.map((o) => ({ value: o.id, label: o.name }));

  return (
    <section className="overflow-hidden rounded-xl border">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b px-4 py-2.5">
        <div className="flex flex-wrap items-center gap-2">
          <Select
            items={items}
            value={current.id}
            onValueChange={(value) => {
              if (typeof value === 'string') setSelected(value);
            }}
          >
            <SelectTrigger aria-label={texts.indicator} className="min-w-56">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {zones.map((zone) => {
                const inZone = options.filter((o) => o.zone === zone);
                return (
                  <SelectGroup key={zone}>
                    <SelectLabel>{inZone[0]?.zoneName ?? zone}</SelectLabel>
                    {inZone.map((o) => (
                      <SelectItem key={o.id} value={o.id}>
                        {o.name}
                      </SelectItem>
                    ))}
                  </SelectGroup>
                );
              })}
            </SelectContent>
          </Select>
          {current.level ? <LevelBadge level={current.level} lang={lang} size="sm" /> : null}
        </div>
        <span className="text-muted-foreground text-xs tabular-nums">
          {format(texts.pointsCount, { n: current.points.length })}
        </span>
      </div>
      <div className="flex flex-col gap-2 px-4 pt-3 pb-4">
        <SeriesChart
          key={current.id}
          points={current.points}
          lang={lang}
          title={current.name}
          unit={current.unit}
          titleExplain={current.explain}
          glossary={current.glossary}
          baseline={current.baseline}
          normalRange={current.green ?? current.normalRange}
          level={current.level}
          kind={current.kind}
          decimals={current.decimals}
          nowAt={nowAt}
          header="full"
          height={240}
        />
      </div>
    </section>
  );
}
