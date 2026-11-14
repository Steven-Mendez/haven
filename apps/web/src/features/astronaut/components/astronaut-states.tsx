import type { Assessment } from '@haven/core';
import { ChevronRight, Clock } from 'lucide-react';
import { bySeverity, countLevels, LevelGlyph, levelLabel, worstLevel } from '@/components/haven';
import { Term } from '@/components/haven/term';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { format, formatDuration, type Language, minutesBetween } from '@/lib/i18n';
import type { AstronautTexts } from '../i18n';
import { ageOf, groupByZone, type Names } from '../logic';
import { IndicatorRow, InRangeGroup } from './indicator-row';

type Props = {
  assessments: Assessment[];
  assessedAt: string | undefined;
  /** Indicator → source of its latest reading. */
  sources: Record<string, string>;
  /** Indicator → latest category value. */
  categories: Record<string, string>;
  /** `AstronautResponse.series`, for the row sparklines. */
  series?: Record<string, [number, number][]>;
  now: string;
  stale: boolean;
  names: Names;
  lang: Language;
  t: AstronautTexts;
};

const COUNT_ORDER = ['red', 'amber', 'pending', 'green'] as const;

/**
 * States tab (DESIGN_SYSTEM.md §8.2): one folded group per zone with its counts («Heart · ◆ 3 · ● 2»); zones
 * with something to look at open by default. Inside, one-line rows; green ones folded as «N in range».
 */
export function AstronautStates({
  assessments,
  assessedAt,
  sources,
  categories,
  series,
  now,
  stale,
  names,
  lang,
  t,
}: Props) {
  const groups = groupByZone(assessments, names);

  return (
    <div className="flex flex-col gap-4">
      {stale && assessedAt ? (
        <p className="border-level-pending-border text-muted-foreground flex items-start gap-2 rounded-lg border border-dashed px-3 py-2 text-xs">
          <Clock aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
          {format(t.staleAssessments, { t: formatDuration(minutesBetween(assessedAt, now)) })}
        </p>
      ) : null}
      <div className="overflow-hidden rounded-xl border">
        <div>
          {groups.map(({ zone, assessments: list }) => {
            const counts = countLevels(list.map((a) => a.level));
            const sorted = bySeverity(list, (a) => a.level);
            const flagged = sorted.filter((a) => a.level !== 'green');
            const green = sorted.filter((a) => a.level === 'green');
            const hasIssues = counts.red + counts.amber > 0;
            const level = worstLevel(list.map((a) => a.level));
            const row = (a: Assessment) => (
              <IndicatorRow
                key={a.indicator}
                a={a}
                ageMin={ageOf(a, assessedAt, now)}
                muted={stale}
                source={sources[a.indicator]}
                category={categories[a.indicator]}
                points={series?.[a.indicator]}
                showActions
                names={names}
                lang={lang}
                t={t}
              />
            );
            return (
              <Collapsible key={zone} defaultOpen={hasIssues} className="border-b last:border-b-0">
                <CollapsibleTrigger className="group/zone bg-card hover:bg-hover flex h-9 w-full cursor-pointer items-center gap-3 px-4 text-left text-sm">
                  <ChevronRight
                    aria-hidden="true"
                    className="text-tertiary size-3.5 shrink-0 transition-transform group-data-[panel-open]/zone:rotate-90"
                  />
                  <span className="flex-1 font-medium">
                    <Term id={zone} lang={lang} nested>
                      {names.zones[zone]?.name ?? zone}
                    </Term>
                    <span className="sr-only">: {levelLabel(level, lang)}</span>
                  </span>
                  <span className="flex items-center gap-3 text-xs tabular-nums">
                    {COUNT_ORDER.filter((l) => counts[l] > 0).map((l) => (
                      <span key={l} className="inline-flex items-center gap-1">
                        <LevelGlyph level={l} size={10} muted={stale} />
                        {counts[l]}
                        <span className="sr-only">{levelLabel(l, lang)}</span>
                      </span>
                    ))}
                  </span>
                </CollapsibleTrigger>
                <CollapsibleContent className="border-t px-2 py-1">
                  {flagged.map(row)}
                  {flagged.length === 0 ? green.map(row) : null}
                  <InRangeGroup
                    count={flagged.length ? green.length : 0}
                    label={format(t.inRangeCount, { n: green.length })}
                    lang={lang}
                  >
                    {green.map(row)}
                  </InRangeGroup>
                </CollapsibleContent>
              </Collapsible>
            );
          })}
        </div>
      </div>
    </div>
  );
}
