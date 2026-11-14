import { ChevronRight, Clock } from 'lucide-react';
import { HoverCard, HoverCardContent, HoverCardTrigger } from '@/components/ui/hover-card';
import { Kbd } from '@/components/ui/kbd';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { format, formatDuration, formatNumber, type Language, minutesBetween } from '@/lib/i18n';
import { cn } from '@/lib/utils';
import { NO_RECENT_DATA_HOURS } from '@/server/types';
import { ActivityRings } from './activity-rings';
import { TimeAgo } from './age-label';
import { crewDisplayLevel, crewMemberLevel, hasOpenEmergency } from './astronaut-card';
import { PeekLink } from './crew-peek';
import { LevelBadge } from './level-badge';
import { LevelGlyph } from './level-glyph';
import { LEVEL_ORDER, levelLabel, ZONE_ORDER } from './levels';
import { ListKeyboardNav } from './list-keyboard-nav';
import { Portrait } from './portrait';
import { crewRings } from './rings-data';
import { ringsSummary } from './rings-legend';
import { RowContextMenu } from './row-context-menu';
import { havenTexts } from './texts';
import type { CrewCard, Now, VisualLevel } from './types';

type Props = {
  members: CrewCard[];
  now: Now;
  lang: Language;
  roles?: Record<string, string>;
  zoneNames?: Record<string, string>;
  hrefFor?: (id: string) => string;
  delayMin?: number;
  indicators?: Record<string, { name: string; unit: string }>;
  id?: string;
  className?: string;
};

const zonePos = (z: string) => {
  const i = (ZONE_ORDER as readonly string[]).indexOf(z);
  return i === -1 ? ZONE_ORDER.length : i;
};

export function compactAgo(at: string, now: Now): string {
  const min = Math.max(0, Math.floor(minutesBetween(at, now)));
  if (min < 60) return `${min} min`;
  const h = Math.floor(min / 60);
  return h < 48 ? `${h} h` : `${Math.floor(h / 24)} d`;
}

function groupByLevel(members: CrewCard[]) {
  const groups = new Map<VisualLevel, CrewCard[]>();
  for (const m of members) {
    const level = crewDisplayLevel(m);
    groups.set(level, [...(groups.get(level) ?? []), m]);
  }
  return [...groups.entries()].sort(([a], [b]) => LEVEL_ORDER[a] - LEVEL_ORDER[b]);
}

function AlertCounts({ member, lang }: { member: CrewCard; lang: Language }) {
  const t = havenTexts[lang];
  const red = member.alerts.filter((a) => a.level === 'red').length;
  const amber = member.alerts.filter((a) => a.level === 'amber').length;
  if (!red && !amber) return <span className="text-tertiary">—</span>;
  return (
    <span className="inline-flex items-center gap-2.5 tabular-nums">
      {red ? (
        <span className="text-level-red inline-flex items-center gap-1">
          <LevelGlyph level="red" size={10} />
          {red}
          <span className="sr-only"> {t.levelRed}</span>
        </span>
      ) : null}
      {amber ? (
        <span className="text-level-amber inline-flex items-center gap-1">
          <LevelGlyph level="amber" size={10} />
          {amber}
          <span className="sr-only"> {t.levelAmber}</span>
        </span>
      ) : null}
    </span>
  );
}

type CardInfo = {
  member: CrewCard;
  now: Now;
  lang: Language;
  role?: string;
  indicators?: Record<string, { name: string; unit: string }>;
};

export function levelTip(member: CrewCard, lang: Language) {
  const t = havenTexts[lang];
  const level = levelLabel(crewDisplayLevel(member), lang);
  if (member.noRecentData) return format(t.levelTipStale, { level });
  const n = member.alerts.length;
  return format(n === 0 ? t.levelTipNone : n === 1 ? t.levelTipOne : t.levelTipMany, { level, n });
}

export function CrewHoverCard({
  member,
  now,
  lang,
  role,
  indicators,
  children,
}: CardInfo & { children: React.ReactNode }) {
  const t = havenTexts[lang];
  const alerts = [...member.alerts]
    .sort((a, b) => (a.level === 'red' ? -1 : 0) - (b.level === 'red' ? -1 : 0))
    .slice(0, 3);
  return (
    <HoverCard>
      <HoverCardTrigger
        delay={500}
        render={<span className="max-w-full shrink-0 truncate font-medium" />}
      >
        {children}
      </HoverCardTrigger>
      <HoverCardContent align="start" className="w-72 gap-3 p-3">
        <div className="flex items-center gap-3">
          <Portrait id={member.id} name={member.name} size={36} />
          <div className="flex min-w-0 flex-col">
            <span className="truncate text-sm font-semibold">{member.name}</span>
            {role ? <span className="text-muted-foreground truncate text-xs">{role}</span> : null}
          </div>
        </div>
        <div className="flex items-center justify-between gap-2">
          <LevelBadge level={crewDisplayLevel(member)} lang={lang} size="sm" />
          {member.lastDataAt ? (
            <span className="text-muted-foreground text-xs tabular-nums">
              {format(t.lastData, { t: formatDuration(minutesBetween(member.lastDataAt, now)) })}
            </span>
          ) : null}
        </div>
        <div className="flex flex-col gap-1 border-t pt-2">
          <span className="text-tertiary text-2xs">
            {alerts.length ? t.outOfRange : t.inRangeAll}
          </span>
          {alerts.map((a) => {
            const info = indicators?.[a.indicator];
            return (
              <span key={a.indicator} className="flex items-center gap-2 text-xs">
                <LevelGlyph level={a.level} size={10} />
                <span className="min-w-0 flex-1 truncate">{info?.name ?? a.indicator}</span>
                {typeof a.value === 'number' ? (
                  <span className="font-medium tabular-nums">
                    {formatNumber(a.value, lang, Number.isInteger(a.value) ? 0 : 1)}
                    {info?.unit ? (
                      <span className="text-muted-foreground ml-1 font-normal">{info.unit}</span>
                    ) : null}
                  </span>
                ) : null}
              </span>
            );
          })}
        </div>
        <span className="text-muted-foreground flex items-center justify-end gap-1.5 text-xs">
          {t.openRow}
          <Kbd>↵</Kbd>
        </span>
      </HoverCardContent>
    </HoverCard>
  );
}

function CrewRow({
  member,
  now,
  lang,
  role,
  zoneNames,
  href,
  delayMin,
  indicators,
}: {
  member: CrewCard;
  now: Now;
  lang: Language;
  role?: string;
  zoneNames?: Record<string, string>;
  href: string;
  delayMin?: number;
  indicators?: Record<string, { name: string; unit: string }>;
}) {
  const t = havenTexts[lang];
  const level = crewDisplayLevel(member);
  const assessed = crewMemberLevel(member);
  const emergency = hasOpenEmergency(member);
  const stale = member.noRecentData;
  const zones = [...member.zones].sort((a, b) => zonePos(a.zone) - zonePos(b.zone));
  const flagged = zones
    .filter((z) => z.level === 'red' || z.level === 'amber')
    .sort((a, b) => LEVEL_ORDER[a.level] - LEVEL_ORDER[b.level]);
  const zonesLabel = zones
    .map((z) =>
      format(t.zoneSummary, {
        name: zoneNames?.[z.zone] ?? z.zone,
        level: levelLabel(z.level, lang),
      }),
    )
    .join(', ');

  return (
    <li className="border-border-subtle relative border-b last:border-b-0" data-level={level}>
      <RowContextMenu href={href} id={member.id} lang={lang}>
        <PeekLink
          href={href}
          peekId={member.id}
          data-row-link
          className="hover:bg-hover focus-visible:bg-active group/row flex min-h-11 items-center gap-3 px-4 text-sm transition-colors duration-100 outline-none md:min-h-9"
        >
          <Tooltip>
            <TooltipTrigger render={<span className="inline-flex" />}>
              <LevelGlyph level={level} size={10} lang={lang} />
            </TooltipTrigger>
            <TooltipContent side="right">{levelTip(member, lang)}</TooltipContent>
          </Tooltip>
          <Tooltip>
            <TooltipTrigger
              render={
                <span className="text-tertiary hidden w-24 shrink-0 truncate font-mono text-xs xl:inline" />
              }
            >
              {member.id}
            </TooltipTrigger>
            <TooltipContent className="font-mono">{member.id}</TooltipContent>
          </Tooltip>
          <span className="flex min-w-0 flex-1 items-baseline gap-2">
            <CrewHoverCard
              member={member}
              now={now}
              lang={lang}
              role={role}
              indicators={indicators}
            >
              {member.name}
            </CrewHoverCard>
            {role ? (
              <Tooltip>
                <TooltipTrigger
                  render={
                    <span className="text-tertiary hidden min-w-0 truncate text-xs lg:inline" />
                  }
                >
                  {role}
                </TooltipTrigger>
                <TooltipContent>{role}</TooltipContent>
              </Tooltip>
            ) : null}
          </span>
          {emergency ? (
            <span className="text-level-red hidden shrink-0 items-center gap-1.5 text-xs font-medium md:inline-flex">
              {t.emergencyOpen}
              {assessed !== 'red' ? (
                <span className="text-muted-foreground font-normal">
                  · {t.assessedAs} {levelLabel(assessed, lang).toLowerCase()}
                </span>
              ) : null}
            </span>
          ) : null}

          <Tooltip>
            <TooltipTrigger
              render={
                <span className="hidden w-44 shrink-0 items-center gap-2.5 overflow-hidden text-xs md:flex" />
              }
            >
              <span className="sr-only">
                {t.zones}: {stale ? `${t.noData}. ` : ''}
                {zonesLabel}
              </span>
              <span aria-hidden="true" className="flex min-w-0 items-center gap-2.5">
                {flagged.length ? (
                  <>
                    {flagged.slice(0, 2).map((z) => (
                      <span key={z.zone} className="inline-flex min-w-0 items-center gap-1">
                        <LevelGlyph level={z.level} size={10} muted={stale} />
                        <span className={cn('truncate', stale && 'text-muted-foreground')}>
                          {zoneNames?.[z.zone] ?? z.zone}
                        </span>
                      </span>
                    ))}
                    {flagged.length > 2 ? (
                      <span className="text-tertiary shrink-0 tabular-nums">
                        {format(t.zonesMore, { n: flagged.length - 2 })}
                      </span>
                    ) : null}
                  </>
                ) : (
                  <span className="text-tertiary">
                    {zones.some((z) => z.level === 'green')
                      ? t.zonesAllInRange
                      : t.zonesNotAssessed}
                  </span>
                )}
              </span>
            </TooltipTrigger>
            <TooltipContent className="flex-col items-start gap-1 py-2">
              {zones.map((z) => (
                <span key={z.zone} className="flex items-center gap-1.5">
                  <LevelGlyph level={z.level} size={10} />
                  {format(t.zoneSummary, {
                    name: zoneNames?.[z.zone] ?? z.zone,
                    level: levelLabel(z.level, lang),
                  })}
                </span>
              ))}
            </TooltipContent>
          </Tooltip>

          <span className="hidden w-16 shrink-0 items-center justify-end gap-2 text-xs tabular-nums md:flex">
            <Tooltip>
              <TooltipTrigger render={<span className="inline-flex" />}>
                <ActivityRings
                  rings={crewRings(member).filter((r) => r.id === 'routine')}
                  size={20}
                  animate={false}
                />
              </TooltipTrigger>
              <TooltipContent>{ringsSummary(crewRings(member), lang)}</TooltipContent>
            </Tooltip>
            {member.dailyProgress ? (
              <span>
                {member.actionsDone}
                <span className="text-tertiary">/{member.actionsTotal}</span>
              </span>
            ) : (
              <span className="text-tertiary">—</span>
            )}
            <span className="sr-only">
              {' '}
              {t.ring}: {ringsSummary(crewRings(member), lang)}
            </span>
          </span>

          <span className="hidden w-16 shrink-0 justify-end text-xs sm:flex">
            <AlertCounts member={member} lang={lang} />
          </span>

          <span className="flex w-20 shrink-0 items-center justify-end gap-1 text-xs">
            {member.lastDataAt ? (
              stale ? (
                <span className="text-foreground inline-flex items-center gap-1">
                  <Clock aria-hidden="true" className="size-3" />
                  <TimeAgo
                    at={member.lastDataAt}
                    lang={lang}
                    receivedAt={member.lastVisibleAt}
                    delayMin={delayMin}
                    staleHours={NO_RECENT_DATA_HOURS}
                  >
                    {compactAgo(member.lastDataAt, now)}
                  </TimeAgo>
                  <span className="sr-only"> · {t.noData}</span>
                </span>
              ) : (
                <TimeAgo
                  at={member.lastDataAt}
                  lang={lang}
                  className="text-muted-foreground"
                  receivedAt={member.lastVisibleAt}
                  delayMin={delayMin}
                  staleHours={NO_RECENT_DATA_HOURS}
                >
                  {compactAgo(member.lastDataAt, now)}
                </TimeAgo>
              )
            ) : (
              <span className="text-tertiary">{t.noDataYet}</span>
            )}
          </span>
          <ChevronRight
            aria-hidden="true"
            className="text-tertiary size-3.5 shrink-0 opacity-0 transition-opacity group-hover/row:opacity-100 group-focus-visible/row:opacity-100"
          />
        </PeekLink>
      </RowContextMenu>
    </li>
  );
}

export function CrewList({
  members,
  now,
  lang,
  roles,
  zoneNames,
  hrefFor,
  delayMin,
  indicators,
  id = 'crew-list',
  className,
}: Props) {
  const t = havenTexts[lang];
  const sorted = [...members].sort((a, b) => a.name.localeCompare(b.name, lang));
  const groups = groupByLevel(sorted);

  return (
    <div id={id} className={cn('overflow-hidden rounded-xl border', className)}>
      <ListKeyboardNav containerId={id} />
      <div className="text-tertiary hidden h-8 items-center gap-3 border-b px-4 text-xs md:flex">
        <span className="w-2.5" />
        <span className="hidden w-24 xl:inline" />
        <span className="flex-1">{t.colAstronaut}</span>
        <span className="w-44">{t.colZones}</span>
        <span className="w-16 text-right">{t.colToday}</span>
        <span className="hidden w-16 text-right sm:inline">{t.colAlerts}</span>
        <span className="w-20 text-right">{t.dataAge}</span>
        <span className="w-3.5" />
      </div>
      {groups.map(([level, list]) => (
        <section key={level} aria-label={`${levelLabel(level, lang)} · ${list.length}`}>
          <h3 className="bg-card flex h-8 items-center gap-2 border-b px-4 text-xs font-medium">
            <LevelGlyph level={level} size={10} />
            <span>{levelLabel(level, lang)}</span>
            <span className="text-tertiary tabular-nums">{list.length}</span>
          </h3>
          <ul>
            {list.map((m) => (
              <CrewRow
                key={m.id}
                member={m}
                now={now}
                lang={lang}
                role={roles?.[m.id]}
                zoneNames={zoneNames}
                href={hrefFor ? hrefFor(m.id) : `/astronaut/${m.id}`}
                delayMin={delayMin}
                indicators={indicators}
              />
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}
