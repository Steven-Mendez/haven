import { symptomById } from '@haven/core';
import { Activity, ArrowLeft, ArrowRight, FileText, ListChecks, Stethoscope } from 'lucide-react';
import Link from 'next/link';
import {
  ago,
  bySeverity,
  CopyId,
  EcgStrip,
  havenTexts,
  LevelBadge,
  LevelGlyph,
  levelLabel,
  TimeAgo,
  worstLevel,
} from '@/components/haven';
import { Term } from '@/components/haven/term';
import { buttonVariants } from '@/components/ui/button';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  format,
  formatClock,
  formatDate,
  formatDuration,
  formatNumber,
  formatTime,
  type Language,
  minutesBetween,
  translate,
} from '@/lib/i18n';
import { cn } from '@/lib/utils';
import type { ReceivedPacket } from '@/server/types';
import { type AstronautTexts, dynamicText } from '../i18n';
import {
  ageOf,
  astronautHref,
  decimalsFor,
  latestCategories,
  latestSources,
  monitorReadings,
  type Names,
  packetHref,
  promptedProtocols,
  symptomsOf,
} from '../logic';
import { IndicatorRow, InRangeGroup } from './indicator-row';

type Props = {
  crewMember: string;
  crewMemberName: string;
  packet: ReceivedPacket;
  now: string;
  names: Names;
  lang: Language;
  t: AstronautTexts;
};

function Block({
  title,
  icon,
  children,
}: {
  title: React.ReactNode;
  icon: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section className="flex min-w-0 flex-col gap-2 px-4 py-3">
      <h3 className="text-muted-foreground inline-flex items-center gap-1.5 text-xs font-medium">
        {icon}
        {title}
      </h3>
      {children}
    </section>
  );
}

function RailRow({ label, children }: { label: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="flex min-h-8 items-center justify-between gap-4 py-1">
      <dt className="text-muted-foreground text-xs">{label}</dt>
      <dd className="min-w-0 truncate text-right text-sm">{children}</dd>
    </div>
  );
}

/** Mono date + time (date dimmed, time bright, Vercel logs) with the full UTC time as tooltip. */
function Stamp({ at, lang }: { at: string; lang: Language }) {
  return (
    <TimeAgo at={at} lang={lang} className="font-mono text-xs">
      <span className="text-muted-foreground">{formatDate(at, lang)}</span> {formatClock(at, lang)}
    </TimeAgo>
  );
}

/**
 * A packet on its own page (SPEC §6, Sentry / incident.io detail): title + inline status line, a 2 px red rule
 * callout with the protocol for an emergency, then the payload (protocol · symptoms · monitor in one hairline
 * box), the assessments (one line each, in-range folded), ECG, photos and notes. Right rail: measured on
 * board, received on Earth, transit and data age.
 */
export function PacketDetail({ crewMember, crewMemberName, packet, now, names, lang, t }: Props) {
  const h = havenTexts[lang];
  const emergency = packet.type === 'emergency';
  const level = worstLevel(packet.assessments.map((a) => a.level));
  const protocols = promptedProtocols(packet.assessments);
  const symptoms = symptomsOf(packet);
  const monitor = emergency ? monitorReadings(packet) : [];
  const sorted = bySeverity(packet.assessments, (a) => a.level);
  const flagged = sorted.filter((a) => a.level !== 'green');
  const green = sorted.filter((a) => a.level === 'green');
  const sources = latestSources([packet]);
  const categories = latestCategories([packet]);
  const row = (a: ReceivedPacket['assessments'][number]) => (
    <IndicatorRow
      key={a.indicator}
      a={a}
      ageMin={ageOf(a, packet.dataAt, now)}
      source={sources[a.indicator]}
      category={categories[a.indicator]}
      showActions
      names={names}
      lang={lang}
      t={t}
    />
  );

  return (
    <article className="flex flex-col gap-6" aria-labelledby="packet-title">
      <header className="flex flex-col gap-3">
        <Link
          href={astronautHref(crewMember, 'packets')}
          className="text-muted-foreground hover:text-foreground hit-area inline-flex items-center gap-1.5 self-start text-xs"
        >
          <ArrowLeft aria-hidden="true" className="size-3.5" />
          {format(t.backToPackets, { name: crewMemberName })}
        </Link>
        <div className="flex flex-col gap-1">
          <h1
            id="packet-title"
            className="flex flex-wrap items-center gap-2.5 text-xl font-semibold tracking-[-0.01em]"
          >
            <Term id={emergency ? 'emergency-packet' : 'routine-packet'} lang={lang}>
              {emergency ? h.emergencyPacket : h.routinePacket}
            </Term>
            {emergency ? (
              <LevelBadge level="red" lang={lang} label={h.levelRed} />
            ) : (
              <LevelBadge level={level} lang={lang} />
            )}
          </h1>
          <p className="text-muted-foreground flex flex-wrap items-center gap-x-1.5 text-xs">
            {emergency && level !== 'red' ? (
              <>
                <span className="text-foreground">
                  {format(t.emergencyOverrides, { level: levelLabel(level, lang) })}
                </span>
                <span aria-hidden="true" className="text-tertiary">
                  ·
                </span>
              </>
            ) : null}
            <span>
              {format(t.measuredReceived, {
                measured: ago(packet.dataAt, now),
                received: ago(packet.receivedAt, now),
              })}
            </span>
            <span aria-hidden="true" className="text-tertiary">
              ·
            </span>
            <CopyId value={packet.id} display={packet.id.slice(0, 8)} lang={lang} />
          </p>
        </div>
      </header>

      <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_300px]">
        <div className="flex min-w-0 flex-col gap-6">
          {emergency ? (
            <div className="border-l-level-red bg-card divide-border-subtle grid divide-y overflow-hidden rounded-r-lg border border-l-2 md:grid-cols-2 md:divide-x md:divide-y-0">
              <Block
                title={
                  <Term id="protocol" lang={lang}>
                    {t.protocol}
                  </Term>
                }
                icon={<ListChecks aria-hidden="true" className="size-3.5" />}
              >
                {protocols.length ? (
                  <ul className="flex flex-col gap-1.5">
                    {protocols.map((id) => {
                      const protocol = names.protocols[id];
                      return (
                        <li key={id} className="flex items-baseline justify-between gap-3 text-sm">
                          <span className="font-medium">{protocol?.name ?? id}</span>
                          {protocol ? (
                            <span className="text-muted-foreground shrink-0 text-xs tabular-nums">
                              {format(t.protocolSteps, { n: protocol.steps })}
                            </span>
                          ) : null}
                        </li>
                      );
                    })}
                  </ul>
                ) : (
                  <p className="text-muted-foreground text-sm">{t.noProtocol}</p>
                )}
              </Block>

              <Block
                title={t.symptoms}
                icon={<Stethoscope aria-hidden="true" className="size-3.5" />}
              >
                {symptoms.length ? (
                  <ul className="flex flex-col gap-2 text-sm">
                    {symptoms.map((id) => {
                      const symptom = symptomById(id);
                      return (
                        <li key={id} className="flex flex-col">
                          <span className="font-medium">
                            {symptom ? translate(symptom.name, lang) : id}
                          </span>
                          {symptom?.description ? (
                            <span className="text-muted-foreground text-xs">
                              {translate(symptom.description, lang)}
                            </span>
                          ) : null}
                        </li>
                      );
                    })}
                  </ul>
                ) : (
                  <p className="text-muted-foreground text-sm">{t.noneReported}</p>
                )}
              </Block>
            </div>
          ) : null}

          {emergency ? (
            <section aria-labelledby="monitor" className="flex flex-col gap-2">
              <h2 id="monitor" className="inline-flex items-center gap-2 text-sm font-semibold">
                <Activity aria-hidden="true" className="text-muted-foreground size-4" />
                {t.monitor}
                {monitor.length ? (
                  <span className="text-tertiary font-normal tabular-nums">{monitor.length}</span>
                ) : null}
              </h2>
              {monitor.length ? (
                <div className="max-h-72 overflow-y-auto rounded-xl border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>{t.colTime}</TableHead>
                        <TableHead>{t.colIndicator}</TableHead>
                        <TableHead className="text-right">{t.colValue}</TableHead>
                        <TableHead className="hidden sm:table-cell">{t.colSource}</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {monitor.map((r) => {
                        const info = names.indicators[r.indicator];
                        const value =
                          typeof r.value === 'number'
                            ? formatNumber(r.value, lang, decimalsFor([r.value]))
                            : (info?.label(String(r.value)) ?? String(r.value));
                        return (
                          <TableRow key={r.id}>
                            <TableCell className="text-muted-foreground font-mono text-xs">
                              {formatTime(r.takenAt, lang).replace(' UTC', '')}
                            </TableCell>
                            <TableCell className="whitespace-normal">
                              <Term id={r.indicator} lang={lang}>
                                {info?.name ?? r.indicator}
                              </Term>
                            </TableCell>
                            <TableCell className="text-right font-medium tabular-nums">
                              {value}
                              {typeof r.value === 'number' && info?.unit ? (
                                <span className="text-muted-foreground ml-1 text-xs font-normal">
                                  {info.unit}
                                </span>
                              ) : null}
                            </TableCell>
                            <TableCell className="text-muted-foreground hidden sm:table-cell">
                              {dynamicText(t, 'source', r.source) || '—'}
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </div>
              ) : (
                <p className="text-muted-foreground text-sm">{t.noMonitor}</p>
              )}
            </section>
          ) : null}

          <section aria-labelledby="packet-assessments" className="flex flex-col gap-2">
            <div className="flex flex-col gap-0.5">
              <h2 id="packet-assessments" className="text-sm font-semibold">
                {h.assessments}
                <span className="text-tertiary ml-2 font-normal tabular-nums">
                  {packet.assessments.length}
                </span>
              </h2>
              {emergency ? (
                <p className="text-muted-foreground text-xs">{t.packetAssessmentsHint}</p>
              ) : null}
            </div>
            <div className="rounded-xl border px-2 py-1">
              {flagged.map(row)}
              {flagged.length === 0 ? green.map(row) : null}
              <InRangeGroup
                count={flagged.length ? green.length : 0}
                label={format(t.inRangeCount, { n: green.length })}
                lang={lang}
              >
                {green.map(row)}
              </InRangeGroup>
            </div>
          </section>

          {packet.ecg ? (
            <section className="flex flex-col gap-2" aria-label={h.ecg}>
              <h2 className="inline-flex items-center gap-2 text-sm font-semibold">
                <Activity aria-hidden="true" className="text-muted-foreground size-4" />
                <Term id="ecg" lang={lang}>
                  {t.ecgTitle}
                </Term>
                <span className="text-muted-foreground text-xs font-normal">
                  {format(t.ecgMeta, { hz: packet.ecg.hz })}
                </span>
              </h2>
              <EcgStrip ecg={packet.ecg} label={h.ecg} scale={h.ecgScale} />
            </section>
          ) : null}

          {packet.photos?.length ? (
            <section className="flex flex-col gap-2">
              <h2 className="text-sm font-semibold">
                {format(h.photos, { n: packet.photos.length })}
              </h2>
              <div className="flex flex-wrap gap-2">
                {packet.photos.map((photo) => (
                  <figure key={photo.uri} className="flex w-40 flex-col gap-1">
                    {/* biome-ignore lint/performance/noImgElement: photos are data URIs or remote URIs sent by the phone */}
                    <img
                      src={photo.uri}
                      alt={photo.note ?? ''}
                      width={160}
                      height={120}
                      className="ring-border h-30 w-40 rounded-lg object-cover ring-1"
                    />
                    {photo.note ? (
                      <figcaption className="text-muted-foreground text-xs">
                        {photo.note}
                      </figcaption>
                    ) : null}
                  </figure>
                ))}
              </div>
            </section>
          ) : null}

          {packet.notes ? (
            <section className="flex flex-col gap-1">
              <h2 className="inline-flex items-center gap-2 text-sm font-semibold">
                <FileText aria-hidden="true" className="text-muted-foreground size-4" />
                {h.notes}
              </h2>
              <p className="text-sm whitespace-pre-line">{packet.notes}</p>
            </section>
          ) : null}
        </div>

        <aside className="flex flex-col gap-4 self-start lg:sticky lg:top-16">
          <section className="rounded-xl border px-4 py-2">
            <dl className="divide-border-subtle flex flex-col divide-y">
              <RailRow label={t.railMeasured}>
                <Stamp at={packet.dataAt} lang={lang} />
              </RailRow>
              <RailRow label={t.railReceived}>
                <Stamp at={packet.receivedAt} lang={lang} />
              </RailRow>
              <RailRow
                label={
                  <Term id="communication-delay" lang={lang}>
                    {t.railTransit}
                  </Term>
                }
              >
                <span className="tabular-nums">
                  {formatDuration(Math.max(0, minutesBetween(packet.dataAt, packet.receivedAt)))}
                </span>
              </RailRow>
              <RailRow label={t.railAge}>
                <span className="tabular-nums">{ago(packet.dataAt, now)}</span>
              </RailRow>
              <RailRow label={t.railAssessment}>
                <LevelBadge level={level} lang={lang} size="sm" />
              </RailRow>
              <RailRow label={h.assessments}>
                <span className="tabular-nums">{packet.assessments.length}</span>
              </RailRow>
            </dl>
          </section>
        </aside>
      </div>
    </article>
  );
}

/**
 * Callout on top of Summary while an emergency is open (incident.io summary): 2 px red rule on the left — the
 * only place besides emergency rows where the rule appears — the timing in one line and «View packet».
 */
export function EmergencyBand({
  crewMember,
  packet,
  now,
  lang,
  t,
}: Pick<Props, 'crewMember' | 'packet' | 'now' | 'lang' | 't'>) {
  return (
    <div
      role="status"
      className="border-l-level-red bg-card flex flex-wrap items-center gap-3 rounded-r-lg border border-l-2 py-2 pr-2 pl-3.5"
    >
      <LevelGlyph level="red" size={12} lang={lang} pulse />
      <p className="min-w-0 flex-1 text-sm">
        <span className="font-medium">{t.emergencyOpenShort}</span>
        <span className="text-muted-foreground">
          {' · '}
          {format(t.emergencyBandTiming, {
            occurred: ago(packet.dataAt, now),
            received: ago(packet.receivedAt, now),
          })}
        </span>
      </p>
      <Link
        href={packetHref(crewMember, packet.id)}
        className={cn(buttonVariants({ variant: 'outline', size: 'sm' }), 'hit-area')}
      >
        {t.viewPacket}
        <ArrowRight aria-hidden="true" />
      </Link>
    </div>
  );
}
