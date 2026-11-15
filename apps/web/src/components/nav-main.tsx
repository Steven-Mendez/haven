'use client';

import {
  ChartNoAxesCombined,
  Footprints,
  Rocket,
  SlidersHorizontal,
  TestTube,
  UserRound,
  Users,
} from 'lucide-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect } from 'react';
import { CommandTrigger } from '@/components/command-menu';
import { levelLabel } from '@/components/haven/levels';
import { havenTexts } from '@/components/haven/texts';
import type { VisualLevel } from '@/components/haven/types';
import {
  SidebarGroup,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuBadge,
  SidebarMenuButton,
  SidebarMenuItem,
} from '@/components/ui/sidebar';
import { Skeleton } from '@/components/ui/skeleton';
import type { Language } from '@/lib/i18n';
import { cn } from '@/lib/utils';

export type NavCrewMember = {
  id: string;
  name: string;
  level: VisualLevel;
  emergency?: boolean;
};

type Props = {
  lang: Language;
  crew: NavCrewMember[];
};

export function NavMainSkeleton() {
  return (
    <SidebarGroup>
      <SidebarMenu className="gap-0.5">
        {Array.from({ length: 6 }, (_, i) => (
          // biome-ignore lint/suspicious/noArrayIndexKey: static placeholders
          <SidebarMenuItem key={i} className="flex h-8 items-center gap-2.5 px-2.5">
            <Skeleton className="size-3.5 animate-none rounded-sm" />
            <Skeleton className="h-2.5 w-24 animate-none group-data-[collapsible=icon]:hidden" />
          </SidebarMenuItem>
        ))}
      </SidebarMenu>
    </SidebarGroup>
  );
}

export function NavMain({ lang, crew }: Props) {
  const t = havenTexts[lang];
  const pathname = usePathname();

  useEffect(() => {
    document.documentElement.lang = lang;
  }, [lang]);

  const pages = [
    { href: '/', label: t.navCrew, icon: Users, active: pathname === '/' },
    {
      href: '/rules',
      label: t.navRulesShort,
      icon: SlidersHorizontal,
      active: pathname === '/rules' || pathname.startsWith('/rules/'),
    },
    {
      href: '/kpi',
      label: t.navKpiShort,
      icon: ChartNoAxesCombined,
      active: pathname === '/kpi',
    },
    { href: '/eva', label: t.navEvaShort, icon: Footprints, active: pathname === '/eva' },
    { href: '/samples', label: t.navSamplesShort, icon: TestTube, active: pathname === '/samples' },
    {
      href: '/missions',
      label: t.navMissions,
      icon: Rocket,
      active: pathname.startsWith('/missions'),
    },
  ];

  return (
    <>
      <div className="px-2 pt-1 group-data-[collapsible=icon]:hidden">
        <CommandTrigger lang={lang} variant="field" />
      </div>
      <SidebarGroup className="pt-2">
        <SidebarGroupLabel className="sr-only">{t.sidebarNav}</SidebarGroupLabel>
        <SidebarMenu className="gap-0.5">
          {pages.map((p) => (
            <SidebarMenuItem key={p.href}>
              <SidebarMenuButton
                className="hit-area"
                isActive={p.active}
                tooltip={p.label}
                render={<Link href={p.href} />}
              >
                <p.icon aria-hidden="true" />
                <span>{p.label}</span>
              </SidebarMenuButton>
            </SidebarMenuItem>
          ))}
        </SidebarMenu>
      </SidebarGroup>

      <SidebarGroup>
        <SidebarGroupLabel>{t.sidebarAstronauts}</SidebarGroupLabel>
        <SidebarMenu className="gap-0.5">
          {crew.length === 0 ? (
            <p className="text-tertiary px-2 text-xs group-data-[collapsible=icon]:hidden">
              {t.sidebarNoCrew}
            </p>
          ) : null}
          {crew.map((m) => {
            const href = `/astronaut/${m.id}`;
            const label = levelLabel(m.level, lang);
            const alertDot =
              m.emergency || m.level === 'red'
                ? 'bg-level-red'
                : m.level === 'amber'
                  ? 'bg-level-amber'
                  : null;
            return (
              <SidebarMenuItem key={m.id}>
                <SidebarMenuButton
                  isActive={pathname === href}
                  tooltip={`${m.name} · ${label}${m.emergency ? ` · ${t.emergencyOpen}` : ''}`}
                  render={<Link href={href} />}
                  className="hit-area pr-8"
                >
                  <UserRound aria-hidden="true" />
                  <span className="truncate">{m.name}</span>
                </SidebarMenuButton>
                <SidebarMenuBadge
                  title={label}
                  className="text-tertiary text-2xs pointer-events-none top-1/2! -translate-y-1/2 font-normal"
                >
                  {alertDot ? (
                    <span
                      aria-hidden="true"
                      className={cn(
                        'size-1.5 rounded-full',
                        alertDot,
                        m.emergency && 'motion-safe:animate-live',
                      )}
                    />
                  ) : null}
                  <span className="sr-only">
                    {label}
                    {m.emergency ? ` · ${t.emergencyOpen}` : ''}
                  </span>
                </SidebarMenuBadge>
                {alertDot ? (
                  <span
                    aria-hidden="true"
                    className={cn(
                      'ring-sidebar pointer-events-none absolute top-1.5 left-5 hidden size-2 rounded-full ring-2 group-data-[collapsible=icon]:block',
                      alertDot,
                      m.emergency && 'motion-safe:animate-live',
                    )}
                  />
                ) : null}
              </SidebarMenuItem>
            );
          })}
        </SidebarMenu>
      </SidebarGroup>
    </>
  );
}
