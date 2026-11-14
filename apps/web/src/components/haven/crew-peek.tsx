'use client';

import { ArrowRight, ChevronDown, ChevronUp } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  type ComponentProps,
  createContext,
  type KeyboardEvent,
  type MouseEvent,
  type ReactNode,
  type RefObject,
  useContext,
  useMemo,
  useRef,
  useState,
} from 'react';
import { buttonVariants } from '@/components/ui/button';
import { Kbd } from '@/components/ui/kbd';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { format, formatDuration, formatNumber, type Language, minutesBetween } from '@/lib/i18n';
import { cn } from '@/lib/utils';
import { ActivityRings } from './activity-rings';
import { crewDisplayLevel } from './astronaut-card';
import { LevelBadge } from './level-badge';
import { LevelGlyph } from './level-glyph';
import { LEVEL_ORDER, levelLabel, ZONE_ORDER } from './levels';
import { Portrait } from './portrait';
import { crewRings } from './rings-data';
import { RingsLegend } from './rings-legend';
import { havenTexts } from './texts';
import type { CrewCard, Now } from './types';

const PeekContext = createContext<((id: string) => void) | null>(null);

type Props = {
  members: CrewCard[];
  now: Now;
  lang: Language;
  roles?: Record<string, string>;
  zoneNames?: Record<string, string>;
  indicators?: Record<string, { name: string; unit: string }>;
  children: ReactNode;
};

/** Same order as the crew list: by level (emergency first), then by name. */
function peekOrder(members: CrewCard[], lang: Language) {
  return [...members]
    .sort(
      (a, b) =>
        LEVEL_ORDER[crewDisplayLevel(a)] - LEVEL_ORDER[crewDisplayLevel(b)] ||
        a.name.localeCompare(b.name, lang),
    )
    .map((m) => m.id);
}

const zonePos = (z: string) => {
  const i = (ZONE_ORDER as readonly string[]).indexOf(z);
  return i === -1 ? ZONE_ORDER.length : i;
};

/**
 * Quick view of a crew member in a right-hand sheet (Time2book / Contra side panel): the crew page stays in
 * place while the operator reads level, emergency, out-of-range readings, zones and today's rings. j / k (or
 * ↑ / ↓) step through the crew, ↵ opens the full profile. Rows opt in with `PeekLink`.
 */
export function CrewPeekProvider({
  members,
  now,
  lang,
  roles,
  zoneNames,
  indicators,
  children,
}: Props) {
  const router = useRouter();
  const [openId, setOpenId] = useState<string | null>(null);
  // Focus lands on the body (not the first header button) so ↵ opens the full profile right away.
  const bodyRef = useRef<HTMLDivElement>(null);
  const order = useMemo(() => peekOrder(members, lang), [members, lang]);
  const index = openId ? order.indexOf(openId) : -1;
  const member = members.find((m) => m.id === openId);
  const profileHref = member ? `/astronaut/${encodeURIComponent(member.id)}` : '/';

  const step = (delta: number) => {
    if (index === -1) return;
    const next = order[Math.min(order.length - 1, Math.max(0, index + delta))];
    if (next) setOpenId(next);
  };

  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    if (e.metaKey || e.ctrlKey || e.altKey) return;
    if (e.key === 'j' || e.key === 'ArrowDown') step(1);
    else if (e.key === 'k' || e.key === 'ArrowUp') step(-1);
    else if (e.key === 'Enter' && !(e.target as HTMLElement).closest('a, button')) {
      router.push(profileHref);
    } else return;
    e.preventDefault();
  };

  return (
    <PeekContext.Provider value={setOpenId}>
      {children}
      <Sheet open={member !== undefined} onOpenChange={(open) => !open && setOpenId(null)}>
        <SheetContent
          onKeyDown={onKeyDown}
          initialFocus={bodyRef}
          className="gap-0 data-[side=right]:w-full data-[side=right]:sm:max-w-md"
        >
          {member ? (
            <PeekBody
              member={member}
              now={now}
              lang={lang}
              role={roles?.[member.id]}
              zoneNames={zoneNames}
              indicators={indicators}
              profileHref={profileHref}
              bodyRef={bodyRef}
              position={{ index, total: order.length, step }}
            />
          ) : null}
        </SheetContent>
      </Sheet>
    </PeekContext.Provider>
  );
}

function PeekBody({
  member,
  now,
  lang,
  role,
  zoneNames,
  indicators,
  profileHref,
  bodyRef,
  position,
}: {
  member: CrewCard;
  now: Now;
  lang: Language;
  role?: string;
  zoneNames?: Record<string, string>;
  indicators?: Record<string, { name: string; unit: string }>;
  profileHref: string;
  bodyRef: RefObject<HTMLDivElement | null>;
  position: { index: number; total: number; step: (delta: number) => void };
}) {
  const t = havenTexts[lang];
  const level = crewDisplayLevel(member);
  const stale = member.noRecentData;
  const packet = member.lastPacket;
  // Same rule as the crew page's emergency inbox: the latest received packet is an emergency.
  const emergency = packet?.type === 'emergency' ? packet : null;
  const zones = [...member.zones].sort((a, b) => zonePos(a.zone) - zonePos(b.zone));
  const rings = crewRings(member);
  const age = member.lastDataAt
    ? format(t.lastData, { t: formatDuration(minutesBetween(member.lastDataAt, now)) })
    : t.noDataYet;
  const navButton = cn(
    buttonVariants({ variant: 'ghost', size: 'icon-sm' }),
    'text-muted-foreground disabled:opacity-30',
  );

  return (
    <>
      <SheetHeader className="flex-row items-center gap-3 border-b py-3 pr-12">
        <Portrait id={member.id} name={member.name} size={40} />
        <div className="flex min-w-0 flex-1 flex-col">
          <SheetTitle className="truncate text-base">{member.name}</SheetTitle>
          <SheetDescription className="truncate text-xs">{role ?? t.peekTitle}</SheetDescription>
        </div>
        <div className="flex items-center">
          <button
            type="button"
            aria-label={t.peekPrev}
            className={navButton}
            disabled={position.index <= 0}
            onClick={() => position.step(-1)}
          >
            <ChevronUp aria-hidden="true" />
          </button>
          <button
            type="button"
            aria-label={t.peekNext}
            className={navButton}
            disabled={position.index >= position.total - 1}
            onClick={() => position.step(1)}
          >
            <ChevronDown aria-hidden="true" />
          </button>
        </div>
      </SheetHeader>

      <div
        ref={bodyRef}
        tabIndex={-1}
        className="flex flex-1 flex-col gap-5 overflow-y-auto p-4 outline-none"
      >
        <div className="flex flex-wrap items-center justify-between gap-2">
          <LevelBadge level={level} lang={lang} size="sm" />
          <span className="text-muted-foreground text-xs tabular-nums">{age}</span>
        </div>

        {emergency ? (
          <div className="border-level-red flex items-center gap-3 rounded-lg border border-l-2 py-2 pr-2 pl-3">
            <LevelGlyph level="red" size={10} lang={lang} />
            <span className="flex-1 text-sm">
              {/* Stale data: the packet is shown, but never called an open emergency (hasOpenEmergency). */}
              {stale ? (
                <span className="font-medium">{t.emergencyPacket}</span>
              ) : (
                <>
                  <span className="font-medium">{t.emergencyOpen}</span>
                  <span className="text-muted-foreground"> · {t.emergencyPacket}</span>
                </>
              )}
            </span>
            <Link
              href={`${profileHref}/packet/${encodeURIComponent(emergency.id)}`}
              className={buttonVariants({ variant: 'outline', size: 'sm' })}
            >
              {t.peekViewPacket}
              <ArrowRight aria-hidden="true" />
            </Link>
          </div>
        ) : null}

        {stale && member.lastDataAt ? (
          <p className="text-muted-foreground rounded-lg border border-dashed px-3 py-2 text-xs">
            {t.peekStale}
          </p>
        ) : null}

        <section className="flex flex-col gap-1.5">
          <h3 className="text-tertiary text-xs">
            {member.alerts.length ? t.outOfRange : t.inRangeAll}
            {member.alerts.length ? (
              <span className="ml-1.5 tabular-nums">{member.alerts.length}</span>
            ) : null}
          </h3>
          {member.alerts.length ? (
            <ul className="flex flex-col rounded-lg border">
              {member.alerts.map((a) => {
                const info = indicators?.[a.indicator];
                return (
                  <li
                    key={a.indicator}
                    className="border-border-subtle flex min-h-9 items-center gap-2.5 border-b px-3 text-sm last:border-b-0"
                  >
                    <LevelGlyph level={a.level} size={10} lang={lang} muted={stale} />
                    <span className="min-w-0 flex-1 truncate">{info?.name ?? a.indicator}</span>
                    {typeof a.value === 'number' ? (
                      <span
                        className={cn(
                          'font-medium whitespace-nowrap tabular-nums',
                          stale && 'text-muted-foreground',
                        )}
                      >
                        {formatNumber(a.value, lang, Number.isInteger(a.value) ? 0 : 1)}
                        {info?.unit ? (
                          <span className="text-muted-foreground ml-1 text-xs font-normal">
                            {info.unit}
                          </span>
                        ) : null}
                      </span>
                    ) : null}
                  </li>
                );
              })}
            </ul>
          ) : null}
        </section>

        {zones.length ? (
          <section className="flex flex-col gap-1.5">
            <h3 className="text-tertiary text-xs">{t.zones}</h3>
            <ul className="flex flex-col gap-1.5">
              {zones.map((z) => (
                <li key={z.zone} className="flex min-w-0 items-center gap-2 text-sm">
                  <LevelGlyph level={z.level} size={10} muted={stale} />
                  <span className="min-w-0 flex-1 truncate">{zoneNames?.[z.zone] ?? z.zone}</span>
                  <span className="text-muted-foreground text-xs">{levelLabel(z.level, lang)}</span>
                </li>
              ))}
            </ul>
          </section>
        ) : null}

        <section className="flex flex-col gap-2">
          <h3 className="text-tertiary text-xs">{t.ring}</h3>
          <div className="flex items-center gap-4 rounded-lg border p-3">
            <ActivityRings rings={rings} size={56} />
            <RingsLegend rings={rings} lang={lang} className="flex-1" />
          </div>
        </section>
      </div>

      <SheetFooter className="border-t">
        <Link
          href={profileHref}
          className={cn(buttonVariants({ variant: 'default' }), 'w-full justify-between')}
        >
          {t.peekOpenProfile}
          <Kbd className="bg-transparent text-current opacity-70">↵</Kbd>
        </Link>
      </SheetFooter>
    </>
  );
}

/**
 * A row link that opens the crew quick view on a plain click (↵ on a focused row too). ⌘/Ctrl/Shift/middle
 * click keep the native link (new tab), and outside a `CrewPeekProvider` it is a normal link.
 */
export function PeekLink({
  peekId,
  onClick,
  ...props
}: ComponentProps<typeof Link> & { peekId: string }) {
  const open = useContext(PeekContext);
  return (
    <Link
      {...props}
      onClick={(e: MouseEvent<HTMLAnchorElement>) => {
        onClick?.(e);
        if (!open || e.defaultPrevented) return;
        if (e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
        e.preventDefault();
        open(peekId);
      }}
    />
  );
}
