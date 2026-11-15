'use client';

import { LevelGlyph } from '@/components/haven';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { format } from '@/lib/i18n';
import { cn } from '@/lib/utils';
import type { EditableIndicator } from '../logic/rules';

type ScaleLevel = 'green' | 'amber' | 'red';
type Segment = { level: ScaleLevel; withSymptoms: ScaleLevel; from?: number; to?: number };

const RANK: Record<ScaleLevel, number> = { green: 0, amber: 1, red: 2 };

function levelAt(v: number, indicator: EditableIndicator, symptoms: boolean): ScaleLevel {
  const [lo, hi] = indicator.green;
  if (v >= lo && v <= hi) return 'green';
  for (const r of indicator.rules) {
    if (r.withSymptoms && !symptoms) continue;
    if (v < r.outside[0] || v > r.outside[1]) return r.level;
  }
  return 'amber';
}

export function scaleOf(indicator: EditableIndicator) {
  const bounds = [
    ...new Set([...indicator.green, ...indicator.rules.flatMap((r) => r.outside)]),
  ].sort((a, b) => a - b);
  const probes = [
    (bounds[0] ?? 0) - 1,
    ...bounds.slice(1).map((b, i) => ((bounds[i] ?? b) + b) / 2),
    (bounds.at(-1) ?? 0) + 1,
  ];
  const segments: Segment[] = [];
  const cuts: number[] = [];
  probes.forEach((v, i) => {
    const seg = { level: levelAt(v, indicator, false), withSymptoms: levelAt(v, indicator, true) };
    const last = segments.at(-1);
    if (last && last.level === seg.level && last.withSymptoms === seg.withSymptoms) return;
    if (i > 0) cuts.push(bounds[i - 1] as number);
    segments.push(seg);
  });
  segments.forEach((s, i) => {
    s.from = cuts[i - 1];
    s.to = cuts[i];
  });
  if ((bounds[0] ?? 1) <= 0 && cuts[0] === bounds[0] && segments.length > 1) {
    segments.shift();
    cuts.shift();
  }
  const top = bounds.at(-1);
  if (
    indicator.unit === '%' &&
    top !== undefined &&
    top >= 100 &&
    cuts.at(-1) === top &&
    segments.length > 1
  ) {
    segments.pop();
    cuts.pop();
  }
  return { segments, cuts };
}

const fmt = (n: number) => String(n);

export type ScaleTexts = {
  below: string;
  above: string;
  between: string;
  withSymptoms: string;
  levels: Record<ScaleLevel, string>;
};

function rangeText(s: Segment, unit: string, t: ScaleTexts) {
  const u = unit ? ` ${unit}` : '';
  if (s.from === undefined && s.to !== undefined) return format(t.below, { v: `${fmt(s.to)}${u}` });
  if (s.to === undefined && s.from !== undefined)
    return format(t.above, { v: `${fmt(s.from)}${u}` });
  return format(t.between, { a: fmt(s.from ?? 0), b: `${fmt(s.to ?? 0)}${u}` });
}

export function RangeScale({
  indicator,
  label,
  texts,
}: {
  indicator: EditableIndicator;
  label: string;
  texts: ScaleTexts;
}) {
  const { segments, cuts } = scaleOf(indicator);
  const n = segments.length;
  return (
    <div role="img" aria-label={label} className="flex w-full max-w-80 min-w-56 flex-col gap-1">
      <div className="flex gap-0.5">
        {segments.map((s, i) => {
          const worse = RANK[s.withSymptoms] > RANK[s.level];
          return (
            <Tooltip
              // biome-ignore lint/suspicious/noArrayIndexKey: stretches are positional
              key={i}
            >
              <TooltipTrigger
                render={<span className="group/seg flex flex-1 cursor-default items-center py-1" />}
              >
                <span
                  className={cn(
                    'h-2 w-full transition-[filter] group-hover/seg:brightness-125',
                    i === 0 && 'rounded-l-full',
                    i === n - 1 && 'rounded-r-full',
                  )}
                  style={{
                    background: worse
                      ? `repeating-linear-gradient(135deg, var(--scale-red) 0 3px, var(--scale-${s.level}) 3px 6px)`
                      : `var(--scale-${s.level})`,
                    opacity: s.level === 'green' ? 0.9 : 1,
                  }}
                />
              </TooltipTrigger>
              <TooltipContent className="flex-col items-start gap-0.5">
                <span className="tabular-nums">{rangeText(s, indicator.unit, texts)}</span>
                <span className="flex items-center gap-1.5 font-medium">
                  <LevelGlyph level={s.level} size={10} />
                  {texts.levels[s.level]}
                </span>
                {worse ? (
                  <span className="flex items-center gap-1.5">
                    <LevelGlyph level={s.withSymptoms} size={10} />
                    {format(texts.withSymptoms, { level: texts.levels[s.withSymptoms] })}
                  </span>
                ) : null}
              </TooltipContent>
            </Tooltip>
          );
        })}
      </div>
      <div
        aria-hidden="true"
        className="text-muted-foreground text-2xs relative h-3.5 tabular-nums"
      >
        {cuts.map((c, i) => (
          <span
            key={c}
            className="absolute -translate-x-1/2"
            style={{ left: `${((i + 1) / n) * 100}%` }}
          >
            {fmt(c)}
          </span>
        ))}
      </div>
    </div>
  );
}
