import { ArrowRight } from 'lucide-react';
import {
  type CrewCard,
  CrewHoverCard,
  compactAgo,
  havenTexts,
  LevelGlyph,
  type Now,
  PeekLink,
  RowContextMenu,
  TimeAgo,
} from '@/components/haven';
import { formatClock, formatDate, type Language } from '@/lib/i18n';
import { texts } from '../i18n';

type Props = {
  crew: CrewCard[];
  now: Now;
  lang: Language;
  roles?: Record<string, string>;
  indicators?: Record<string, { name: string; unit: string }>;
  delayMin?: number;
};

/**
 * Open emergencies (SPEC §6 «Paquetes de emergencia», Vercel logs / Sentry inbox): one 52 px row per crew member
 * whose latest received packet is an emergency, newest first. 2 px red rule on the left (emergencies only),
 * mono Earth receive time, data age and a link to the packet. Renders nothing when there is none.
 */
export function EmergencyInbox({ crew, now, lang, roles, indicators, delayMin }: Props) {
  const t = texts[lang];
  const h = havenTexts[lang];
  const open = crew
    .filter((m) => m.lastPacket?.type === 'emergency')
    .sort(
      (a, b) =>
        Date.parse(b.lastPacket?.visibleAt ?? '') - Date.parse(a.lastPacket?.visibleAt ?? ''),
    );
  if (!open.length) return null;

  return (
    <section aria-labelledby="emergency-inbox" className="flex flex-col gap-2">
      <h2 id="emergency-inbox" className="text-sm font-semibold">
        {t.emergenciesTitle}
        <span className="text-tertiary ml-2 font-normal tabular-nums">{open.length}</span>
      </h2>
      <ul className="overflow-hidden rounded-xl border">
        {open.map((m) => {
          const packet = m.lastPacket;
          if (!packet) return null;
          const href = `/astronaut/${encodeURIComponent(m.id)}/packet/${encodeURIComponent(packet.id)}`;
          return (
            <li key={m.id} className="border-border-subtle border-b last:border-b-0">
              <RowContextMenu href={href} id={packet.id} lang={lang}>
                <PeekLink
                  href={href}
                  peekId={m.id}
                  className="hover:bg-hover focus-visible:bg-active group/row border-level-red relative flex min-h-13 items-center gap-3 border-l-2 py-2 pr-4 pl-3.5 transition-colors outline-none"
                >
                  <LevelGlyph level="red" size={10} lang={lang} />
                  <span className="flex min-w-0 flex-1 flex-col">
                    <span className="flex min-w-0 items-baseline text-sm font-medium">
                      <CrewHoverCard
                        member={m}
                        now={now}
                        lang={lang}
                        role={roles?.[m.id]}
                        indicators={indicators}
                      >
                        {m.name}
                      </CrewHoverCard>
                      <span className="text-muted-foreground truncate font-normal">
                        {'\u00a0'}· {h.emergencyPacket}
                      </span>
                    </span>
                    <span className="text-tertiary flex items-center gap-1.5 text-xs">
                      <span className="font-mono">
                        {formatDate(packet.visibleAt, lang)}{' '}
                        <span className="text-muted-foreground">
                          {formatClock(packet.visibleAt, lang)}
                        </span>
                      </span>
                      <span aria-hidden="true">·</span>
                      <span>{t.receivedOnEarth}</span>
                    </span>
                  </span>
                  {m.noRecentData ? (
                    <span className="text-muted-foreground hidden text-xs sm:inline">
                      {h.noData}
                    </span>
                  ) : (
                    <span className="text-level-red hidden text-xs font-medium sm:inline">
                      {h.emergencyOpen}
                    </span>
                  )}
                  <TimeAgo
                    at={m.lastDataAt ?? packet.visibleAt}
                    lang={lang}
                    className="text-tertiary w-12 text-right text-xs"
                    receivedAt={packet.visibleAt}
                    delayMin={delayMin}
                  >
                    {compactAgo(packet.visibleAt, now)}
                  </TimeAgo>
                  <ArrowRight
                    aria-hidden="true"
                    className="text-tertiary group-hover/row:text-foreground size-3.5 shrink-0"
                  />
                </PeekLink>
              </RowContextMenu>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
