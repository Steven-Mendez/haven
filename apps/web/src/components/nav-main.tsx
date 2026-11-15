'use client';

import { Activity, Footprints, Pill, Rocket, SlidersHorizontal, Users } from 'lucide-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect } from 'react';
import { CommandTrigger } from '@/components/command-menu';
import { LevelGlyph } from '@/components/haven/level-glyph';
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
          <SidebarMenuItem key={i} className="flex h-7 items-center gap-2 px-2">
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
    { href: '/trends', label: t.navTrendsShort, icon: Activity, active: pathname === '/trends' },
    { href: '/eva', label: t.navEvaShort, icon: Footprints, active: pathname === '/eva' },
    {
      href: '/medication',
      label: t.navMedicationShort,
      icon: Pill,
      active: pathname === '/medication',
    },
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
            return (
              <SidebarMenuItem key={m.id}>
                <SidebarMenuButton
                  isActive={pathname === href}
                  tooltip={`${m.name} · ${label}${m.emergency ? ` · ${t.emergencyOpen}` : ''}`}
                  render={<Link href={href} />}
                  className="hit-area pr-8"
                >
                  <span className="grid size-4 place-items-center">
                    <LevelGlyph level={m.level} size={10} className="opacity-100!" />
                  </span>
                  <span className="truncate">{m.name}</span>
                </SidebarMenuButton>
                <SidebarMenuBadge
                  title={label}
                  className="text-tertiary text-2xs pointer-events-none top-1/2! -translate-y-1/2 font-normal"
                >
                  {m.emergency ? (
                    <span
                      aria-hidden="true"
                      className="bg-level-red motion-safe:animate-live size-1.5 rounded-full"
                    />
                  ) : null}
                  <span className="sr-only">
                    {label}
                    {m.emergency ? ` · ${t.emergencyOpen}` : ''}
                  </span>
                </SidebarMenuBadge>
              </SidebarMenuItem>
            );
          })}
        </SidebarMenu>
      </SidebarGroup>
    </>
  );
}
