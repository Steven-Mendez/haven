import type { ReactNode } from 'react';
import {
  ActivityRings,
  type AstronautResponse,
  ago,
  crewRings,
  havenTexts,
  LevelBadge,
  RingsLegend,
  ringsSummary,
  TimeAgo,
  type VisualLevel,
  WeekRings,
  weekRings,
} from '@/components/haven';
import { explain, Term } from '@/components/haven/term';
import { formatClock, formatDate, formatDuration, type Language, minutesBetween } from '@/lib/i18n';
import type { AstronautTexts } from '../i18n';
import { byNewest, type Names } from '../logic';

type Props = {
  data: AstronautResponse;
  level: VisualLevel;
  names: Names;
  lang: Language;
  t: AstronautTexts;
};

function Row({ label, children }: { label: ReactNode; children: ReactNode }) {
  return (
    <div className="flex min-h-8 items-center justify-between gap-4 py-1">
      <dt className="text-muted-foreground text-xs">{label}</dt>
      <dd className="min-w-0 truncate text-right text-sm">{children}</dd>
    </div>
  );
}

function Stamp({ at, lang }: { at: string; lang: Language }) {
  return (
    <TimeAgo at={at} lang={lang} className="font-mono text-xs">
      <span className="text-muted-foreground">{formatDate(at, lang)}</span> {formatClock(at, lang)}
    </TimeAgo>
  );
}

export function AstronautProperties({ data, level, names, lang, t }: Props) {
  const h = havenTexts[lang];
  const { crewMember: member, generatedAt: now } = data;
  const last = byNewest(data.packets)[0];
  const rings = crewRings(member);

  return (
    <aside aria-label={t.railTitle} className="flex flex-col gap-4 self-start lg:sticky lg:top-16">
      <section aria-labelledby="rings-title" className="flex flex-col gap-4 rounded-xl border p-4">
        <h2
          id="rings-title"
          className="text-muted-foreground flex items-baseline justify-between text-xs"
        >
          {h.ringsTitle}
          <span className="text-tertiary text-2xs">{h.ringsNote}</span>
        </h2>
        <div className="flex items-center gap-4">
          <ActivityRings
            rings={rings}
            size={104}
            label={ringsSummary(rings, lang)}
            center={`${rings.reduce((n, r) => n + Math.min(r.value, r.total), 0)}/${rings.reduce((n, r) => n + r.total, 0)}`}
          />
          <RingsLegend
            rings={rings}
            lang={lang}
            className="min-w-0 flex-1"
            explanations={{
              routine: explain('daily-actions', lang),
              wellbeing: explain('check-in', lang),
            }}
          />
        </div>
        <div className="flex flex-col gap-2 border-t pt-3">
          <span className="text-tertiary text-2xs">{h.ringsWeek}</span>
          <WeekRings
            days={weekRings(data.packets, (id) => names.indicators[id]?.zone, now)}
            lang={lang}
          />
        </div>
      </section>
      <section className="rounded-xl border px-4 py-2">
        <h2 className="sr-only">{t.railTitle}</h2>
        <dl className="divide-border-subtle flex flex-col divide-y">
          <Row label={t.railLevel}>
            <LevelBadge level={level} lang={lang} size="sm" />
          </Row>
          {last ? (
            <>
              <Row label={t.railMeasured}>
                <Stamp at={last.dataAt} lang={lang} />
              </Row>
              <Row label={t.railReceived}>
                <Stamp at={last.receivedAt} lang={lang} />
              </Row>
              <Row
                label={
                  <Term id="communication-delay" lang={lang}>
                    {t.railTransit}
                  </Term>
                }
              >
                <span className="tabular-nums">
                  {formatDuration(Math.max(0, minutesBetween(last.dataAt, last.receivedAt)))}
                </span>
              </Row>
              <Row label={t.railAge}>
                <span
                  className={member.noRecentData ? 'text-foreground font-medium' : 'tabular-nums'}
                >
                  {ago(last.dataAt, now)}
                </span>
              </Row>
            </>
          ) : null}
          <Row label={t.railPackets}>
            <span className="tabular-nums">{data.packets.length}</span>
          </Row>
          {names.environmentName ? <Row label={h.environment}>{names.environmentName}</Row> : null}
          <Row label={t.watch}>{member.hasWatch ? t.withWatch : t.withoutWatch}</Row>
        </dl>
      </section>
    </aside>
  );
}
