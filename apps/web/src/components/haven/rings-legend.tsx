import { type Language, localeOf } from '@/lib/i18n';
import { cn } from '@/lib/utils';
import { ActivityRings } from './activity-rings';
import { type DayRings, type RingDatum, type RingId, ringCount } from './rings-data';
import { type TermExplanation, TermTip } from './term-tip';
import { havenTexts } from './texts';

const TOKEN: Record<RingId, 1 | 2 | 3> = { routine: 1, measurements: 2, wellbeing: 3 };

/** Ring names in the current language. */
export function ringName(id: RingId, lang: Language) {
  const t = havenTexts[lang];
  return { routine: t.ringRoutine, measurements: t.ringMeasurements, wellbeing: t.ringWellbeing }[
    id
  ];
}

/** Accessible one-line summary: «Routine 3/7, Measurements 7/7, Wellbeing 1/1». */
export function ringsSummary(rings: RingDatum[], lang: Language) {
  return rings.map((r) => `${ringName(r.id, lang)} ${ringCount(r)}`).join(', ');
}

/** Legend next to the rings: colour dot, name (explained by the glossary) and count («3/4»). */
export function RingsLegend({
  rings,
  lang,
  explanations,
  className,
}: {
  rings: RingDatum[];
  lang: Language;
  explanations?: Partial<Record<RingId, TermExplanation | undefined>>;
  className?: string;
}) {
  return (
    <dl className={cn('flex flex-col gap-1.5', className)}>
      {rings.map((r) => (
        <div key={r.id} className="flex items-center gap-2 text-sm">
          <span
            aria-hidden="true"
            className="size-2 shrink-0 rounded-full"
            style={{ background: `var(--ring-${TOKEN[r.id]})` }}
          />
          <dt className="text-muted-foreground flex-1 text-xs">
            <TermTip explanation={explanations?.[r.id]}>{ringName(r.id, lang)}</TermTip>
          </dt>
          <dd className="font-medium tabular-nums">{ringCount(r)}</dd>
        </div>
      ))}
    </dl>
  );
}

/** A week of mini rings (24 px) with narrow weekday labels; today is highlighted. */
export function WeekRings({ days, lang }: { days: DayRings[]; lang: Language }) {
  const weekday = new Intl.DateTimeFormat(localeOf(lang), { weekday: 'narrow', timeZone: 'UTC' });
  const date = new Intl.DateTimeFormat(localeOf(lang), {
    weekday: 'long',
    day: 'numeric',
    month: 'short',
    timeZone: 'UTC',
  });
  return (
    <ol className="flex items-end justify-between gap-1">
      {days.map((d) => (
        <li key={d.day} className="flex flex-col items-center gap-1">
          <ActivityRings
            rings={d.rings}
            size={24}
            animate={false}
            label={`${date.format(new Date(d.day))}: ${ringsSummary(d.rings, lang)}`}
            className={d.empty ? 'opacity-60' : undefined}
          />
          <span
            aria-hidden="true"
            className={cn('text-2xs', d.today ? 'text-foreground font-semibold' : 'text-tertiary')}
          >
            {weekday.format(new Date(d.day))}
          </span>
        </li>
      ))}
    </ol>
  );
}
