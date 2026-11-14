import { ArrowUpRight } from 'lucide-react';
import Link from 'next/link';
import { LevelGlyph, MiniTrend, TermTip } from '@/components/haven';
import { format, formatNumber, type Language } from '@/lib/i18n';
import { cn } from '@/lib/utils';
import type { TrendOption } from './trends-panel';

type Props = {
  /** Up to four indicators, already chosen on the server (flagged first). */
  options: TrendOption[];
  /** Link of a tile: the Trends tab with that indicator selected. */
  hrefFor: (indicator: string) => string;
  /** No recent data: shapes and figures go grey (last known values, never shown as current). */
  stale?: boolean;
  lang: Language;
  texts: { title: string; vsMedian: string; openTrend: string };
};

/**
 * Metric tiles of the Summary tab (n8n / Hotjar overview tiles): name, latest value (28 px, tabular), delta
 * vs. the personal median and a 48 px trend. Each tile opens the Trends tab with that indicator, so the
 * full chart lives in one place only.
 */
export function VitalTiles({ options, hrefFor, stale, lang, texts }: Props) {
  if (!options.length) return null;
  return (
    // Container query: four across only when the main column (not the viewport) has room.
    <section aria-label={texts.title} className="@container">
      <ul className="bg-border grid grid-cols-2 gap-px overflow-hidden rounded-xl border @2xl:grid-cols-4">
        {options.map((o) => {
          const last = o.points[o.points.length - 1]?.[1];
          const delta = last !== undefined && o.baseline ? last - o.baseline.median : undefined;
          const deltaText =
            delta !== undefined
              ? `${delta > 0 ? '+' : delta < 0 ? '−' : '±'}${formatNumber(Math.abs(delta), lang, o.decimals)}`
              : null;
          return (
            <li key={o.id} className="bg-background md:bg-surface">
              <Link
                href={hrefFor(o.id)}
                aria-label={format(texts.openTrend, { name: o.name })}
                className="group/tile hover:bg-hover focus-visible:ring-ring relative flex size-full flex-col gap-1 px-4 pt-3 pb-3.5 transition-colors outline-none focus-visible:ring-2 focus-visible:ring-inset"
              >
                <span className="text-muted-foreground flex min-h-8 w-full min-w-0 items-start gap-1.5 pr-4 text-xs leading-4">
                  {o.level ? (
                    <span className="flex h-4 shrink-0 items-center">
                      <LevelGlyph level={o.level} size={10} lang={lang} muted={stale} />
                    </span>
                  ) : null}
                  <TermTip explanation={o.explain} nested className="line-clamp-3">
                    {o.name}
                  </TermTip>
                </span>
                <ArrowUpRight
                  aria-hidden="true"
                  className="text-tertiary group-hover/tile:text-foreground absolute top-3 right-3 size-3.5 transition-colors"
                />
                <span className="mt-auto flex items-baseline gap-1">
                  <span
                    className={cn(
                      'text-[28px] leading-8 font-medium tracking-[-0.02em] tabular-nums',
                      stale && 'text-muted-foreground',
                    )}
                  >
                    {last !== undefined ? formatNumber(last, lang, o.decimals) : '—'}
                  </span>
                  {o.unit ? <span className="text-muted-foreground text-sm">{o.unit}</span> : null}
                </span>
                <span className="text-muted-foreground text-xs tabular-nums">
                  {deltaText ? format(texts.vsMedian, { d: deltaText }) : ' '}
                </span>
                <MiniTrend
                  points={o.points}
                  level={o.level}
                  className={cn('mt-2', stale && 'opacity-60')}
                />
              </Link>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
