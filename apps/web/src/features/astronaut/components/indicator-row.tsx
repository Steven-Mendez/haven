import type { Assessment } from '@haven/core';
import { ChevronRight } from 'lucide-react';
import { LevelBadge, Sparkline } from '@/components/haven';
import { Term } from '@/components/haven/term';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { format, formatDuration, formatNumber, type Language, translate } from '@/lib/i18n';
import { type AstronautTexts, dynamicText } from '../i18n';
import { decimalsFor, type Names } from '../logic';

type Props = {
  a: Assessment;
  /** Minutes since the reading, on the server clock; undefined when unknown. */
  ageMin: number | undefined;
  /** Greys the level out (last known status of a stale crew member). */
  muted?: boolean;
  /** Source of the latest reading (`Reading.source`), shown in the expanded metadata line. */
  source?: string;
  /** Latest category value for `kind: 'category'` indicators (`sinus`), shown translated as the value. */
  category?: string;
  /** Show this indicator's own suggested actions when expanded (off in Summary, where they are grouped). */
  showActions?: boolean;
  /** `AstronautResponse.series[indicator]`: drawn as a 60 × 16 sparkline before the value. */
  points?: [number, number][];
  names: Names;
  lang: Language;
  t: AstronautTexts;
};

/** Value + unit of an assessment, or undefined (category indicators carry no number). */
export function assessmentValue(a: Assessment, names: Names, lang: Language) {
  if (typeof a.value !== 'number') return undefined;
  const info = names.indicators[a.indicator];
  const unit = info?.kind === 'number' ? info.unit : '';
  return { text: formatNumber(a.value, lang, decimalsFor([a.value])), unit };
}

/**
 * One-line indicator row (DESIGN_SYSTEM.md §8.0.3): level symbol · name · value · age · chevron.
 * Expanding shows the engine's explanation, the usual range, source and age, and (optionally) the actions.
 */
export function IndicatorRow({
  a,
  ageMin,
  muted,
  source,
  category,
  showActions,
  points,
  names,
  lang,
  t,
}: Props) {
  const info = names.indicators[a.indicator];
  const name = info?.name ?? a.indicator;
  const value =
    assessmentValue(a, names, lang) ??
    (category && info?.kind === 'category' ? { text: info.label(category), unit: '' } : undefined);
  const age = ageMin !== undefined ? format(t.measuredAgo, { t: formatDuration(ageMin) }) : '';
  const ago = ageMin !== undefined ? format(t.agoShort, { t: formatDuration(ageMin) }) : '';
  const sourceText = source ? dynamicText(t, 'source', source) : '';
  const actions = [...a.actions].sort((x, y) => x.priority - y.priority);
  const unit = value?.unit ?? '';

  return (
    <Collapsible className="border-border-subtle border-b last:border-b-0">
      <CollapsibleTrigger className="group/row hover:bg-hover flex min-h-9 w-full cursor-pointer items-center gap-3 rounded-md px-2 text-left text-sm transition-colors">
        <LevelBadge level={a.level} lang={lang} size="sm" symbolOnly muted={muted} />
        <span className="line-clamp-2 min-w-0 flex-1 py-1.5 leading-5">
          <Term id={a.indicator} lang={lang} nested>
            {name}
          </Term>
        </span>
        {points && points.length > 1 ? (
          <Sparkline
            points={points}
            level={muted ? undefined : a.level}
            className="hidden shrink-0 md:block"
          />
        ) : null}
        {value ? (
          <span className="shrink-0 font-medium whitespace-nowrap tabular-nums">
            {value.text}
            {unit ? (
              <>
                {' '}
                <span className="text-muted-foreground text-xs font-normal">{unit}</span>
              </>
            ) : null}
          </span>
        ) : null}
        {ago ? (
          <span
            title={age}
            className="text-muted-foreground hidden min-w-20 shrink-0 text-right text-xs whitespace-nowrap tabular-nums sm:inline"
          >
            {ago}
          </span>
        ) : null}
        {/* The row's accessible name is its own content (level, name, value, age; WCAG 2.5.3) plus the source. */}
        {sourceText ? <span className="sr-only">, {sourceText}</span> : null}
        <ChevronRight
          aria-hidden="true"
          className="text-tertiary size-3.5 shrink-0 transition-transform group-data-[panel-open]/row:rotate-90"
        />
      </CollapsibleTrigger>
      <CollapsibleContent className="flex flex-col gap-2 pr-2 pb-3 pl-10 text-sm">
        <p className="text-muted-foreground">{translate(a.explanation, lang)}</p>
        <p className="text-muted-foreground flex flex-wrap items-center gap-x-1.5 gap-y-1 text-xs">
          {[sourceText, ago].filter(Boolean).join(' · ')}
        </p>
        {a.baseline && unit ? (
          <p className="text-muted-foreground text-xs">
            {format(t.baselineLabel, {
              min: formatNumber(a.baseline.range[0], lang, decimalsFor(a.baseline.range)),
              max: formatNumber(a.baseline.range[1], lang, decimalsFor(a.baseline.range)),
              unit,
            })}
          </p>
        ) : null}
        {showActions && actions.length ? (
          <div className="flex flex-col gap-1 rounded-lg border px-3 py-2">
            <span className="text-muted-foreground text-xs font-medium">{t.suggestedActions}</span>
            <ol className="flex list-decimal flex-col gap-0.5 pl-4">
              {actions.map((action) => (
                <li key={action.id}>{translate(action.text, lang)}</li>
              ))}
            </ol>
          </div>
        ) : null}
      </CollapsibleContent>
    </Collapsible>
  );
}

/** «24 in range ›» folded group of green rows (DESIGN_SYSTEM.md §8.0.4). */
export function InRangeGroup({
  count,
  label,
  lang,
  children,
}: {
  count: number;
  label: string;
  lang: Language;
  children: React.ReactNode;
}) {
  if (count === 0) return null;
  return (
    <Collapsible>
      <CollapsibleTrigger className="group/range text-muted-foreground hover:bg-hover flex min-h-9 w-full cursor-pointer items-center gap-3 rounded-md px-2 text-left text-sm">
        <LevelBadge level="green" lang={lang} size="sm" symbolOnly label={label} />
        <span className="flex-1">{label}</span>
        <ChevronRight
          aria-hidden="true"
          className="size-3.5 shrink-0 transition-transform group-data-[panel-open]/range:rotate-90"
        />
      </CollapsibleTrigger>
      <CollapsibleContent className="pl-4">{children}</CollapsibleContent>
    </Collapsible>
  );
}
