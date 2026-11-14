import type { Packet } from '@haven/core';
import { Activity, Camera, ChevronDown, FileText, Send, Siren } from 'lucide-react';
import { Fragment } from 'react';
import { Card } from '@/components/ui/card';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { format, formatDate, formatTime, type Language, translate } from '@/lib/i18n';
import { cn } from '@/lib/utils';
import { TimeAgo } from './age-label';
import { EcgStrip } from './ecg-strip';
import { EmptyState } from './empty-state';
import { LevelBadge } from './level-badge';
import { LevelGlyph } from './level-glyph';
import { ago, bySeverity, levelLabel, worstLevel } from './levels';
import { havenTexts } from './texts';
import type { Now, ReceivedPacket } from './types';

type Props = {
  packets: (ReceivedPacket | Packet)[];
  now: Now;
  lang: Language;
  indicatorNames?: Record<string, string>;
  openId?: string;
  title?: string;
  emptyText?: string;
  className?: string;
};

const sentAtOf = (p: ReceivedPacket | Packet) => ('dataAt' in p ? p.dataAt : p.sentAt);

export function Timeline({
  packets,
  now,
  lang,
  indicatorNames,
  openId,
  title,
  emptyText,
  className,
}: Props) {
  const t = havenTexts[lang];
  const byArrival = [...packets].sort((a, b) => Date.parse(b.visibleAt) - Date.parse(a.visibleAt));

  return (
    <section className={cn('flex flex-col gap-3', className)}>
      <h2 className="text-[15px] leading-[22px] font-semibold">{title ?? t.timeline}</h2>
      {byArrival.length === 0 ? (
        <EmptyState title={emptyText ?? t.noPackets} />
      ) : (
        <ol className="before:bg-border relative flex flex-col gap-4 before:absolute before:top-2 before:bottom-2 before:left-[11px] before:w-px">
          {byArrival.map((p, index) => {
            const level = worstLevel(p.assessments.map((a) => a.level));
            const emergency = p.type === 'emergency';
            const sentAt = sentAtOf(p);
            const sorted = bySeverity(p.assessments, (a) => a.level);
            const flagged = sorted.filter((a) => a.level !== 'green');
            const normal = sorted.filter((a) => a.level === 'green');
            const day = formatDate(p.visibleAt, lang);
            const prevDay =
              index > 0 ? formatDate(byArrival[index - 1]?.visibleAt ?? '', lang) : '';
            return (
              <Fragment key={p.id}>
                {day !== prevDay ? (
                  <li className="text-muted-foreground pl-10 text-xs font-medium">{day}</li>
                ) : null}
                <li className="relative flex gap-4">
                  <span
                    aria-hidden="true"
                    className="bg-card text-muted-foreground z-10 mt-3.5 grid size-6 shrink-0 place-items-center rounded-full border text-[10px]"
                  >
                    {emergency ? <LevelGlyph level="red" size={10} /> : <Send className="size-3" />}
                  </span>
                  <Card size="sm" className="min-w-0 flex-1 py-0">
                    <Collapsible defaultOpen={p.id === openId}>
                      <CollapsibleTrigger className="group/trigger flex min-h-12 w-full cursor-pointer flex-wrap items-center gap-x-3 gap-y-1 px-4 py-3 text-left">
                        <time
                          dateTime={p.visibleAt}
                          className="text-muted-foreground font-mono text-xs"
                        >
                          {formatTime(p.visibleAt, lang)}
                        </time>
                        <span className="inline-flex items-center gap-1.5 text-sm font-medium">
                          {emergency ? (
                            <Siren aria-hidden="true" className="text-muted-foreground size-4" />
                          ) : null}
                          {emergency ? t.emergencyPacket : t.routinePacket}
                        </span>
                        <LevelBadge level={level} lang={lang} size="sm" />
                        <span className="text-muted-foreground text-xs">
                          <TimeAgo at={p.visibleAt} lang={lang}>
                            {format(t.received, { t: ago(p.visibleAt, now) })}
                          </TimeAgo>
                          {' · '}
                          <TimeAgo at={sentAt} lang={lang}>
                            {format(t.sent, { t: ago(sentAt, now) })}
                          </TimeAgo>
                        </span>
                        <span className="text-muted-foreground ml-auto inline-flex items-center gap-3 text-xs">
                          <span>{format(t.readings, { n: p.readings.length })}</span>
                          {p.photos?.length ? (
                            <span className="inline-flex items-center gap-1">
                              <Camera aria-hidden="true" className="size-3.5" />
                              {format(t.photos, { n: p.photos.length })}
                            </span>
                          ) : null}
                          {p.ecg ? (
                            <span className="inline-flex items-center gap-1">
                              <Activity aria-hidden="true" className="size-3.5" />
                              {t.ecg}
                            </span>
                          ) : null}
                          <ChevronDown
                            aria-hidden="true"
                            className="size-4 transition-transform group-data-[panel-open]/trigger:rotate-180"
                          />
                        </span>
                      </CollapsibleTrigger>

                      <CollapsibleContent className="flex flex-col gap-4 border-t px-4 py-4">
                        {flagged.length ? (
                          <div className="flex flex-col gap-2">
                            <h3 className="text-muted-foreground text-[13px] font-medium">
                              {t.assessments}
                            </h3>
                            <ul className="flex flex-col gap-2">
                              {flagged.map((a) => (
                                <li
                                  key={a.indicator}
                                  className="bg-muted/60 flex flex-col gap-1 rounded-md px-3 py-2"
                                >
                                  <div className="flex flex-wrap items-center gap-2 text-sm">
                                    <LevelBadge level={a.level} lang={lang} size="sm" />
                                    <span className="font-medium">
                                      {indicatorNames?.[a.indicator] ?? a.indicator}
                                    </span>
                                    {a.value !== undefined ? (
                                      <span className="numeric text-muted-foreground">
                                        {a.value}
                                      </span>
                                    ) : null}
                                  </div>
                                  <p className="text-muted-foreground text-sm">
                                    {translate(a.explanation, lang)}
                                  </p>
                                </li>
                              ))}
                            </ul>
                          </div>
                        ) : null}

                        {normal.length ? (
                          <div className="flex flex-col gap-2">
                            <h3 className="text-muted-foreground text-[13px] font-medium">
                              {format(t.inNormalRange, { n: normal.length })}
                            </h3>
                            <ul className="flex flex-wrap gap-1.5">
                              {normal.map((a) => (
                                <li
                                  key={a.indicator}
                                  title={translate(a.explanation, lang)}
                                  className="border-border inline-flex h-7 items-center gap-1.5 rounded-full border px-2.5 text-xs"
                                >
                                  <LevelGlyph level="green" size={10} />
                                  <span className="sr-only">{levelLabel('green', lang)}:</span>
                                  {indicatorNames?.[a.indicator] ?? a.indicator}
                                  {a.value !== undefined ? (
                                    <span className="numeric text-muted-foreground">{a.value}</span>
                                  ) : null}
                                </li>
                              ))}
                            </ul>
                          </div>
                        ) : null}

                        {p.ecg ? <EcgStrip ecg={p.ecg} label={t.ecg} scale={t.ecgScale} /> : null}

                        {p.photos?.length ? (
                          <div className="flex flex-wrap gap-2">
                            {p.photos.map((photo) => (
                              <figure key={photo.uri} className="flex w-32 flex-col gap-1">
                                {/* biome-ignore lint/performance/noImgElement: photos are data URIs or remote URIs sent by the phone */}
                                <img
                                  src={photo.uri}
                                  alt={photo.note ?? ''}
                                  width={128}
                                  height={96}
                                  className="ring-border h-24 w-32 rounded-md object-cover ring-1"
                                />
                                {photo.note ? (
                                  <figcaption className="text-muted-foreground text-xs">
                                    {photo.note}
                                  </figcaption>
                                ) : null}
                              </figure>
                            ))}
                          </div>
                        ) : null}

                        {p.notes ? (
                          <div className="flex flex-col gap-1">
                            <h3 className="text-muted-foreground inline-flex items-center gap-1.5 text-[13px] font-medium">
                              <FileText aria-hidden="true" className="size-3.5" />
                              {t.notes}
                            </h3>
                            <p className="text-sm whitespace-pre-line">{p.notes}</p>
                          </div>
                        ) : null}
                      </CollapsibleContent>
                    </Collapsible>
                  </Card>
                </li>
              </Fragment>
            );
          })}
        </ol>
      )}
    </section>
  );
}
