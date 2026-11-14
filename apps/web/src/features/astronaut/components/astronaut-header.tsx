import Link from 'next/link';
import {
  AgeLabel,
  type AstronautResponse,
  ago,
  crewMemberLevel,
  LevelBadge,
  levelLabel,
  Portrait,
  TimeAgo,
  type VisualLevel,
} from '@/components/haven';
import { Term } from '@/components/haven/term';
import { format, type Language, translate } from '@/lib/i18n';
import { cn } from '@/lib/utils';
import type { AstronautTexts } from '../i18n';
import { astronautHref, byNewest, TABS, type Tab } from '../logic';

type Props = {
  data: AstronautResponse;
  tab: Tab;
  /** Level to show: an open emergency has priority over the zone assessment (presentation only). */
  level: VisualLevel;
  lang: Language;
  t: AstronautTexts;
};

/**
 * Header (DESIGN_SYSTEM.md §8.2, Sentry inline status): portrait 32, name 20/600 and the level chip, then one
 * 12 px status line (role · last packet). When an emergency is open the chip says so and the line names the
 * zone assessment, so «Check» never sits unexplained next to an open emergency. The five tabs are links
 * (`?tab=`) with the active one underlined in the accent.
 */
export function AstronautHeader({ data, tab, level, lang, t }: Props) {
  const { crewMember: member, generatedAt: now } = data;
  const last = byNewest(data.packets)[0];
  const assessed = crewMemberLevel(member);
  const overridden = level === 'red' && assessed !== 'red' && assessed !== 'no-data';
  const tabLabels: Record<Tab, string> = {
    summary: t.tabSummary,
    states: t.tabStates,
    trends: t.tabTrends,
    packets: t.tabPackets,
    notes: t.tabNotes,
  };

  return (
    <header className="flex flex-col gap-4">
      <div className="flex min-w-0 items-center gap-3">
        <Portrait id={member.id} name={member.name} size={36} />
        <div className="flex min-w-0 flex-col gap-0.5">
          <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1">
            <h1 className="truncate text-xl font-semibold tracking-[-0.01em]">{member.name}</h1>
            <Term id={`level-${level === 'no-data' ? 'pending' : level}`} lang={lang} plain>
              <LevelBadge
                level={level}
                lang={lang}
                size="md"
                label={overridden ? t.emergencyOpenShort : undefined}
              />
            </Term>
          </div>
          <p className="text-muted-foreground flex flex-wrap items-center gap-x-1.5 text-xs">
            {overridden ? (
              <>
                <span className="text-foreground">
                  {format(t.emergencyOverrides, { level: levelLabel(assessed, lang) })}
                </span>
                <span aria-hidden="true" className="text-tertiary">
                  ·
                </span>
              </>
            ) : null}
            {member.role ? <span>{translate(member.role, lang)}</span> : null}
            {member.role ? (
              <span aria-hidden="true" className="text-tertiary">
                ·
              </span>
            ) : null}
            {member.noRecentData || !last ? (
              <AgeLabel
                lastDataAt={member.lastDataAt}
                now={now}
                lang={lang}
                noRecentData={member.noRecentData}
              />
            ) : (
              <TimeAgo at={last.dataAt} lang={lang}>
                {t.lastPacket}:{' '}
                {format(t.measuredReceived, {
                  measured: ago(last.dataAt, now),
                  received: ago(last.receivedAt, now),
                }).toLowerCase()}
              </TimeAgo>
            )}
          </p>
        </div>
      </div>
      <nav aria-label={t.tabsLabel} className="flex overflow-x-auto border-b">
        {TABS.map((id) => (
          <Link
            key={id}
            href={astronautHref(member.id, id)}
            aria-current={id === tab ? 'page' : undefined}
            scroll={false}
            className={cn(
              'text-muted-foreground hover:text-foreground relative -mb-px flex h-9 shrink-0 items-center px-3 text-sm font-medium transition-colors first:pl-0.5',
              'after:absolute after:inset-x-3 after:bottom-0 after:h-0.5 after:rounded-full first:after:left-0.5',
              id === tab ? 'text-foreground after:bg-brand' : 'after:bg-transparent',
            )}
          >
            {tabLabels[id]}
          </Link>
        ))}
      </nav>
    </header>
  );
}
