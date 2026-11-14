import { ChevronRight, Clock } from 'lucide-react';
import Link from 'next/link';
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  Item,
  ItemActions,
  ItemContent,
  ItemDescription,
  ItemGroup,
  ItemTitle,
} from '@/components/ui/item';
import { format, formatDuration, type Language, minutesBetween, translate } from '@/lib/i18n';
import { cn } from '@/lib/utils';
import { AgeLabel } from './age-label';
import { DayRing } from './day-ring';
import { LevelBadge } from './level-badge';
import { bySeverity, worstLevel, ZONE_ORDER } from './levels';
import { Portrait } from './portrait';
import { havenTexts } from './texts';
import type { CrewCard, Now, VisualLevel } from './types';

type Props = {
  /** One entry of `CrewResponse.crew`. */
  member: CrewCard;
  now: Now;
  lang: Language;
  /** Role on board («Commander», «Flight engineer»…), already translated. */
  role?: string;
  /** Zone id → display name (config `Zone.name`, translated). Falls back to the id. */
  zoneNames?: Record<string, string>;
  /** Indicator id → display name (config `Indicator.name`, translated). Falls back to the id. */
  indicatorNames?: Record<string, string>;
  /** Detail link, usually `/astronaut/${id}`. */
  href?: string;
  /** Overrides the built-in portrait; `null` shows initials. */
  portrait?: string | null;
  maxAlerts?: number;
  className?: string;
};

const zonePos = (z: string) => {
  const i = (ZONE_ORDER as readonly string[]).indexOf(z);
  return i === -1 ? ZONE_ORDER.length : i;
};

/** Overall visual level of a crew card: «no recent data» wins, then the worst zone. */
export function crewMemberLevel(member: Pick<CrewCard, 'noRecentData' | 'zones'>) {
  return member.noRecentData ? ('no-data' as const) : worstLevel(member.zones.map((z) => z.level));
}

/** The latest received packet is an emergency and the data is recent: an emergency is open. */
export function hasOpenEmergency(member: Pick<CrewCard, 'noRecentData' | 'lastPacket'>) {
  return !member.noRecentData && member.lastPacket?.type === 'emergency';
}

/**
 * Level to show for a crew member (presentation only, the data is unchanged): an open emergency takes
 * priority over the zone assessment, so «Check» is never shown next to an open emergency.
 */
export function crewDisplayLevel(
  member: Pick<CrewCard, 'noRecentData' | 'zones' | 'lastPacket'>,
): VisualLevel {
  return hasOpenEmergency(member) ? 'red' : crewMemberLevel(member);
}

/**
 * One card per astronaut on shadcn `Card` + `Item` (ref. Deel, Sentry): portrait, name, role, day ring,
 * status per zone with symbol + label, active alerts and data age. With `noRecentData` the card is
 * dashed, its levels are greyed out and it says the status is the last one received.
 */
export function AstronautCard({
  member,
  now,
  lang,
  role,
  zoneNames,
  indicatorNames,
  href,
  portrait,
  maxAlerts = 3,
  className,
}: Props) {
  const t = havenTexts[lang];
  const stale = member.noRecentData;
  const level = crewMemberLevel(member);
  const alerts = bySeverity(member.alerts, (a) => a.level);
  const shown = alerts.slice(0, maxAlerts);
  const hidden = alerts.length - shown.length;
  const zones = [...member.zones].sort((a, b) => zonePos(a.zone) - zonePos(b.zone));

  return (
    <Card
      aria-labelledby={`astronaut-${member.id}`}
      data-level={level}
      className={cn(
        'gap-3 [--card-spacing:--spacing(5)]',
        stale && 'border-level-pending-border border border-dashed ring-0',
        className,
      )}
    >
      <CardHeader className="flex items-start gap-3">
        <Portrait id={member.id} name={member.name} src={portrait} size={56} />
        <div className="flex min-w-0 flex-1 flex-col gap-0.5">
          <CardTitle
            id={`astronaut-${member.id}`}
            className="truncate text-[15px] leading-[22px] font-semibold"
          >
            {member.name}
          </CardTitle>
          {role ? <CardDescription className="truncate">{role}</CardDescription> : null}
          <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1">
            <AgeLabel
              lastDataAt={member.lastDataAt}
              now={now}
              lang={lang}
              noRecentData={member.noRecentData}
            />
          </div>
        </div>
        <DayRing segments={member.dailyProgress} lang={lang} zoneNames={zoneNames} size={60} />
      </CardHeader>

      <CardContent className="flex flex-col gap-4">
        {stale && member.lastDataAt ? (
          <p className="border-level-pending-border text-foreground flex gap-2 rounded-md border border-dashed px-3 py-2 text-[13px]">
            <Clock aria-hidden="true" className="mt-0.5 size-3.5 shrink-0" />
            {format(t.staleWarning, { t: formatDuration(minutesBetween(member.lastDataAt, now)) })}
          </p>
        ) : null}

        <section aria-label={t.zones}>
          <h3 className="text-muted-foreground mb-1 text-[13px] font-medium">{t.zones}</h3>
          <ItemGroup className="divide-border/70 gap-0 divide-y">
            {zones.map((z) => (
              <Item
                key={z.zone}
                size="xs"
                role="listitem"
                className="min-h-9 rounded-none px-0 py-1"
              >
                <ItemContent>
                  <ItemTitle className="font-normal">{zoneNames?.[z.zone] ?? z.zone}</ItemTitle>
                </ItemContent>
                <ItemActions>
                  <LevelBadge level={z.level} lang={lang} size="sm" muted={stale} />
                </ItemActions>
              </Item>
            ))}
          </ItemGroup>
        </section>

        <section aria-label={t.alerts}>
          <h3 className="text-muted-foreground mb-2 text-[13px] font-medium">{t.alerts}</h3>
          {shown.length ? (
            <ItemGroup className="gap-2">
              {shown.map((a) => (
                <Item
                  key={a.indicator}
                  role="listitem"
                  variant="muted"
                  size="sm"
                  className="bg-muted/60 rounded-md"
                >
                  <ItemContent className="min-w-0">
                    <ItemTitle className="w-full">
                      <LevelBadge level={a.level} lang={lang} size="sm" muted={stale} />
                      <span className="truncate">
                        {indicatorNames?.[a.indicator] ?? a.indicator}
                      </span>
                    </ItemTitle>
                    <ItemDescription>{translate(a.explanation, lang)}</ItemDescription>
                  </ItemContent>
                </Item>
              ))}
              {hidden > 0 ? <p className="text-muted-foreground text-xs">+{hidden}</p> : null}
            </ItemGroup>
          ) : (
            <p className="text-muted-foreground text-sm">{t.noAlerts}</p>
          )}
        </section>
      </CardContent>

      {href ? (
        <CardFooter className="mt-auto border-t p-0">
          <Link
            href={href}
            className="hover:bg-accent focus-visible:bg-accent flex min-h-12 w-full items-center justify-between px-4 text-sm font-medium transition-colors"
          >
            {t.viewDetail}
            <ChevronRight aria-hidden="true" className="size-4" />
          </Link>
        </CardFooter>
      ) : null}
    </Card>
  );
}
