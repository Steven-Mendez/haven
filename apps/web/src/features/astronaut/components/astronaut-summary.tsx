import { ChevronRight, Clock } from 'lucide-react';
import Link from 'next/link';
import type { ReactNode } from 'react';
import {
  type AstronautResponse,
  bySeverity,
  LevelGlyph,
  type VisualLevel,
} from '@/components/haven';
import { format, formatDuration, type Language, minutesBetween, translate } from '@/lib/i18n';
import type { ReceivedPacket } from '@/server/types';
import type { AstronautTexts } from '../i18n';
import {
  ageOf,
  astronautHref,
  groupedActions,
  latestCategories,
  latestSources,
  type Names,
} from '../logic';
import { AstronautProperties } from './astronaut-properties';
import { IndicatorRow } from './indicator-row';

type Props = {
  data: AstronautResponse;
  assessed: ReceivedPacket | undefined;
  /** Level shown for the crew member (open emergency first). */
  level: VisualLevel;
  /** Metric tiles (VitalTiles), rendered first in the main column. */
  vitals?: ReactNode;
  names: Names;
  lang: Language;
  t: AstronautTexts;
};

/** Rows of «Needs attention» shown in Summary; the rest are one click away in the States tab. */
const ATTENTION_ROWS = 5;

/**
 * Summary tab (DESIGN_SYSTEM.md §8.2, SPEC §6): main column = metric tiles driving one chart, then «Needs
 * attention» (red and amber only, one 36 px line each, expandable) and one grouped «What HAVEN prompted on
 * board» block; right rail = properties (received, transit, data age…).
 */
export function AstronautSummary({ data, assessed, level, vitals, names, lang, t }: Props) {
  const now = data.generatedAt;
  const member = data.crewMember;
  const stale = member.noRecentData;
  const flagged = bySeverity(
    data.assessments.filter((a) => a.level === 'red' || a.level === 'amber'),
    (a) => a.level,
  );
  const inRange = data.assessments.filter((a) => a.level === 'green').length;
  const others = data.assessments.length - flagged.length - inRange;
  const hidden = Math.max(0, flagged.length - ATTENTION_ROWS);
  const actions = groupedActions(flagged);
  const sources = latestSources(data.packets);
  const categories = latestCategories(data.packets);

  return (
    <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_300px]">
      <div className="flex min-w-0 flex-col gap-6">
        {vitals}

        <section aria-labelledby="needs-attention" className="flex flex-col gap-2">
          <h2 id="needs-attention" className="text-sm font-semibold">
            {t.needsAttention}
            <span className="text-tertiary ml-2 font-normal tabular-nums">{flagged.length}</span>
          </h2>

          {stale && assessed ? (
            <p className="border-level-pending-border text-muted-foreground flex items-start gap-2 rounded-lg border border-dashed px-3 py-2 text-xs">
              <Clock aria-hidden="true" className="mt-0.5 size-3.5 shrink-0" />
              {format(t.staleAssessments, {
                t: formatDuration(minutesBetween(assessed.dataAt, now)),
              })}
            </p>
          ) : null}

          <div className="overflow-hidden rounded-xl border">
            {flagged.length ? (
              <div className="px-2 py-1">
                {flagged.slice(0, ATTENTION_ROWS).map((a) => (
                  <IndicatorRow
                    key={a.indicator}
                    a={a}
                    ageMin={ageOf(a, assessed?.dataAt, now)}
                    muted={stale}
                    source={sources[a.indicator]}
                    category={categories[a.indicator]}
                    points={data.series[a.indicator]}
                    names={names}
                    lang={lang}
                    t={t}
                  />
                ))}
              </div>
            ) : (
              <p className="text-muted-foreground px-4 py-6 text-center text-sm">
                {data.assessments.length ? t.nothingNeedsAttention : t.noAssessments}
              </p>
            )}

            {hidden + inRange + others > 0 ? (
              <Link
                href={astronautHref(member.id, 'states')}
                className="text-muted-foreground hover:bg-hover hover:text-foreground bg-card flex h-9 items-center gap-3 border-t px-4 text-xs transition-colors"
              >
                <LevelGlyph level={hidden ? 'amber' : 'green'} size={10} muted={stale} />
                <span className="flex-1">
                  {[
                    hidden ? format(t.moreFlagged, { n: hidden }) : '',
                    inRange ? format(t.inRangeCount, { n: inRange }) : '',
                    others ? format(t.pendingCount, { n: others }) : '',
                  ]
                    .filter(Boolean)
                    .join(' · ')}
                </span>
                <ChevronRight aria-hidden="true" className="size-3.5" />
              </Link>
            ) : null}
          </div>
        </section>

        {actions.length ? (
          <section aria-labelledby="prompted" className="flex flex-col gap-2">
            <h2 id="prompted" className="text-sm font-semibold">
              {t.promptedOnBoard}
            </h2>
            <ol className="flex flex-col overflow-hidden rounded-xl border">
              {actions.map((action, i) => (
                <li
                  key={action.id}
                  className="border-border-subtle flex min-h-9 items-start gap-3 border-b px-4 py-2 text-sm last:border-b-0"
                >
                  <span className="text-tertiary w-4 shrink-0 font-mono text-xs leading-5 tabular-nums">
                    {i + 1}
                  </span>
                  <span>{translate(action.text, lang)}</span>
                </li>
              ))}
            </ol>
          </section>
        ) : null}
      </div>

      <AstronautProperties data={data} level={level} names={names} lang={lang} t={t} />
    </div>
  );
}
