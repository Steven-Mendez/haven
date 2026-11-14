import { Activity, Camera, ChevronRight } from 'lucide-react';
import Link from 'next/link';
import {
  ago,
  EmptyState,
  havenTexts,
  LevelBadge,
  LevelGlyph,
  RowContextMenu,
  worstLevel,
} from '@/components/haven';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { format, formatClock, formatDate, type Language } from '@/lib/i18n';
import { cn } from '@/lib/utils';
import type { ReceivedPacket } from '@/server/types';
import type { AstronautTexts } from '../i18n';
import { astronautHref, byNewest, PACKETS_PER_TAB, packetHref } from '../logic';

type Props = {
  crewMember: string;
  packets: ReceivedPacket[];
  now: string;
  showAll: boolean;
  lang: Language;
  t: AstronautTexts;
};

function PacketRow({
  crewMember,
  p,
  now,
  lang,
  t,
}: {
  crewMember: string;
  p: ReceivedPacket;
  now: string;
  lang: Language;
  t: AstronautTexts;
}) {
  const h = havenTexts[lang];
  const level = worstLevel(p.assessments.map((a) => a.level));
  const emergency = p.type === 'emergency';
  return (
    <li className="border-border-subtle border-b last:border-b-0">
      <RowContextMenu href={packetHref(crewMember, p.id)} id={p.id} lang={lang}>
        <Link
          href={packetHref(crewMember, p.id)}
          className={cn(
            'hover:bg-hover focus-visible:bg-active group/row flex min-h-11 items-center gap-3 border-l-2 py-1.5 pr-4 pl-3.5 text-sm transition-colors outline-none',
            emergency ? 'border-level-red' : 'border-transparent',
          )}
        >
          <time dateTime={p.dataAt} className="w-12 shrink-0 font-mono text-xs tabular-nums">
            {formatClock(p.dataAt, lang)}
          </time>
          {emergency ? (
            <LevelBadge level="red" lang={lang} size="sm" label={h.levelRed} />
          ) : (
            <span className="inline-flex w-5 justify-center">
              <LevelGlyph level={level} size={10} lang={lang} />
            </span>
          )}
          <span className={cn('min-w-0 flex-1 truncate', emergency && 'font-medium')}>
            {emergency ? h.emergencyPacket : h.routinePacket}
            {p.assessments.length ? (
              <span className="text-muted-foreground font-normal">
                {' · '}
                {format(h.readings, { n: p.readings.length })}
              </span>
            ) : null}
          </span>
          <span className="text-muted-foreground hidden text-xs tabular-nums md:inline">
            {format(t.measuredReceived, {
              measured: ago(p.dataAt, now),
              received: ago(p.receivedAt, now),
            })}
          </span>
          <span className="text-muted-foreground inline-flex w-14 items-center justify-end gap-2">
            {p.ecg ? <IconTip label={h.ecg} icon={<Activity className="size-3.5" />} /> : null}
            {p.photos?.length ? (
              <IconTip
                label={format(h.photos, { n: p.photos.length })}
                icon={<Camera className="size-3.5" />}
              />
            ) : null}
            <ChevronRight aria-hidden="true" className="text-tertiary size-3.5" />
          </span>
        </Link>
      </RowContextMenu>
    </li>
  );
}

function IconTip({ label, icon }: { label: string; icon: React.ReactNode }) {
  return (
    <Tooltip>
      <TooltipTrigger render={<span className="inline-flex" />}>
        {icon}
        <span className="sr-only">{label}</span>
      </TooltipTrigger>
      <TooltipContent>{label}</TooltipContent>
    </Tooltip>
  );
}

function byDay(packets: ReceivedPacket[], lang: Language) {
  const groups: { day: string; items: ReceivedPacket[] }[] = [];
  for (const p of packets) {
    const day = formatDate(p.dataAt, lang);
    const last = groups[groups.length - 1];
    if (last?.day === day) last.items.push(p);
    else groups.push({ day, items: [p] });
  }
  return groups;
}

export function PacketList({ crewMember, packets, now, showAll, lang, t }: Props) {
  if (packets.length === 0) return <EmptyState title={havenTexts[lang].noPackets} />;
  const all = byNewest(packets);
  const pinned = all.find((p) => p.type === 'emergency');
  const rest = all.filter((p) => p !== pinned);
  const shown = showAll ? rest : rest.slice(0, PACKETS_PER_TAB);

  return (
    <div className="flex flex-col gap-4">
      <p className="text-muted-foreground text-xs">{format(t.packetsCount, { n: all.length })}</p>
      <div className="overflow-hidden rounded-xl border">
        {pinned ? (
          <section aria-label={t.pinned} className="border-b">
            <h3 className="bg-card text-muted-foreground flex h-8 items-center gap-2 border-b px-4 text-xs font-medium">
              {t.pinned}
              <span className="text-tertiary font-mono font-normal">
                {formatDate(pinned.dataAt, lang)}
              </span>
            </h3>
            <ul>
              <PacketRow crewMember={crewMember} p={pinned} now={now} lang={lang} t={t} />
            </ul>
          </section>
        ) : null}
        {byDay(shown, lang).map((g) => (
          <section
            key={g.day}
            aria-label={g.day}
            className="border-border-subtle border-b last:border-b-0"
          >
            <h3 className="text-muted-foreground border-border-subtle text-2xs flex h-7 items-center justify-between border-b px-4 font-mono">
              <span>{g.day}</span>
              {g.items.length > 1 ? (
                <span className="text-tertiary font-sans tabular-nums">{g.items.length}</span>
              ) : null}
            </h3>
            <ul>
              {g.items.map((p) => (
                <PacketRow key={p.id} crewMember={crewMember} p={p} now={now} lang={lang} t={t} />
              ))}
            </ul>
          </section>
        ))}
      </div>
      {!showAll && rest.length > shown.length ? (
        <Link
          href={`${astronautHref(crewMember, 'packets')}&all=1`}
          scroll={false}
          className="text-link hit-area self-start text-xs hover:underline"
        >
          {format(t.seeAll, { n: rest.length })}
        </Link>
      ) : (
        <p className="text-tertiary text-center text-xs">{t.endOfPackets}</p>
      )}
    </div>
  );
}
