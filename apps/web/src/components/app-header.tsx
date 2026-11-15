'use client';

import { comms, commsMode } from '@haven/core';
import { SatelliteDish, WifiOff } from 'lucide-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Fragment } from 'react';
import { type CommandCrewMember, CommandMenu, CommandTrigger } from '@/components/command-menu';
import { Hint } from '@/components/haven/hint';
import { havenTexts } from '@/components/haven/texts';
import { KeyboardShortcuts } from '@/components/keyboard-shortcuts';
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from '@/components/ui/breadcrumb';
import { Separator } from '@/components/ui/separator';
import { SidebarTrigger } from '@/components/ui/sidebar';
import { format, formatDelay, type Language } from '@/lib/i18n';

type Props = {
  lang: Language;
  day?: number;
  linkDown?: boolean;
  /** One-way light delay of the mission, in minutes. */
  delayMin?: number;
  crewNames?: Record<string, string>;
  crew?: CommandCrewMember[];
};

type Crumb = { label: string; href?: string };

const HEADER =
  'bg-surface/80 sticky top-0 z-30 flex h-[calc(3.25rem_+_env(safe-area-inset-top))] shrink-0 items-center gap-2 border-b pt-[env(safe-area-inset-top)] pr-[max(0.75rem,env(safe-area-inset-right))] pl-[max(0.75rem,env(safe-area-inset-left))] backdrop-blur-md md:rounded-tl-3xl md:pr-5 md:pl-5';

/** The link with the crew: live, delayed or autonomous, with what that means for a reply. */
function LinkChip({ delayMin, t }: { delayMin: number; t: (typeof havenTexts)['es'] }) {
  const mode = commsMode({ currentDelayMin: delayMin, linkDown: false }, comms);
  const oneWay = formatDelay(delayMin);
  const vars = { t: oneWay, rt: formatDelay(delayMin * 2) };
  const label =
    mode === 'realtime'
      ? t.linkRealtime
      : format(mode === 'autonomous' ? t.linkAutonomous : t.linkDelayed, vars);
  const hint = format(
    mode === 'realtime'
      ? t.linkRealtimeHint
      : mode === 'autonomous'
        ? t.linkAutonomousHint
        : t.linkDelayedHint,
    vars,
  );
  return (
    <Hint label={hint}>
      <span
        className="hidden h-6 items-center gap-1.5 rounded-md border px-2 tabular-nums md:inline-flex"
        data-testid="link-chip"
      >
        <SatelliteDish aria-hidden="true" className="size-3.5" />
        {label}
        <span className="sr-only">. {hint}</span>
      </span>
    </Hint>
  );
}

export function AppHeaderSkeleton() {
  return (
    <header className={HEADER}>
      <SidebarTrigger className="-ml-1" aria-label="Panel" />
    </header>
  );
}

export function AppHeader({ lang, day, linkDown, delayMin, crewNames, crew = [] }: Props) {
  const t = havenTexts[lang];
  const pathname = usePathname();

  const crumbs: Crumb[] = [];
  if (pathname === '/rules') crumbs.push({ label: t.navRulesShort });
  else if (pathname.startsWith('/rules/'))
    crumbs.push({ label: t.navRulesShort, href: '/rules' }, { label: t.editThresholdsCrumb });
  else if (pathname === '/kpi') crumbs.push({ label: t.navKpiShort });
  else if (pathname === '/eva') crumbs.push({ label: t.navEvaShort });
  else if (pathname === '/reentry') crumbs.push({ label: t.navReentryShort });
  else if (pathname === '/medication') crumbs.push({ label: t.navMedicationShort });
  else if (pathname === '/samples') crumbs.push({ label: t.navSamplesShort });
  else if (pathname === '/exercise') crumbs.push({ label: t.navExerciseShort });
  else if (pathname === '/motion') crumbs.push({ label: t.navMotionShort });
  else if (pathname === '/workload') crumbs.push({ label: t.navWorkloadShort });
  else if (pathname === '/missions/new')
    crumbs.push({ label: t.navMissions, href: '/missions' }, { label: t.newMissionCrumb });
  else if (/^\/missions\/[^/]+\/plan$/.test(pathname))
    crumbs.push(
      { label: t.navMissions, href: '/missions' },
      { label: t.missionCrumb, href: pathname.replace(/\/plan$/, '') },
      { label: t.planCrumb },
    );
  else if (/^\/missions\/[^/]+$/.test(pathname))
    crumbs.push({ label: t.navMissions, href: '/missions' }, { label: t.missionCrumb });
  else if (pathname.startsWith('/missions')) crumbs.push({ label: t.navMissions });
  else if (pathname.startsWith('/settings')) crumbs.push({ label: t.navSettings });
  else if (pathname === '/crew')
    crumbs.push({ label: t.navCrew, href: '/' }, { label: t.manageCrewCrumb });
  else if (pathname.startsWith('/astronaut/')) {
    const id = decodeURIComponent(pathname.split('/')[2] ?? '');
    crumbs.push({ label: t.navCrew, href: '/' }, { label: crewNames?.[id] ?? id });
  } else if (pathname === '/') crumbs.push({ label: t.navCrew });
  else crumbs.push({ label: t.notFoundTitle });

  return (
    <header className={HEADER}>
      <div className="flex min-w-0 flex-1 items-center gap-2">
        <Hint label={t.toggleSidebar} kbd="⌘B">
          <SidebarTrigger className="hit-area -ml-1" aria-label={t.toggleSidebar} />
        </Hint>
        <Separator
          orientation="vertical"
          className="mr-1 data-vertical:h-4 data-vertical:self-auto"
        />
        <Breadcrumb aria-label={t.breadcrumb} className="min-w-0">
          <BreadcrumbList className="flex-nowrap gap-1.5 text-sm sm:gap-1.5">
            {crumbs.map((c, i) => (
              <Fragment key={c.label}>
                {i > 0 ? <BreadcrumbSeparator className="text-tertiary hidden md:block" /> : null}
                <BreadcrumbItem
                  className={i < crumbs.length - 1 ? 'hidden min-w-0 md:inline-flex' : 'min-w-0'}
                >
                  {c.href ? (
                    <BreadcrumbLink
                      render={<Link href={c.href} />}
                      className="text-muted-foreground hover:text-foreground"
                    >
                      {c.label}
                    </BreadcrumbLink>
                  ) : (
                    <BreadcrumbPage className="truncate font-medium">{c.label}</BreadcrumbPage>
                  )}
                </BreadcrumbItem>
              </Fragment>
            ))}
          </BreadcrumbList>
        </Breadcrumb>
      </div>

      <div className="text-muted-foreground flex shrink-0 items-center gap-3 text-xs">
        {day ? (
          <span className="hidden tabular-nums lg:inline">{format(t.dayChip, { n: day })}</span>
        ) : null}
        {linkDown ? (
          <span className="text-foreground inline-flex h-6 items-center gap-1.5 rounded-md border px-2">
            <WifiOff aria-hidden="true" className="size-3.5" />
            {t.linkDownShort}
          </span>
        ) : delayMin !== undefined ? (
          <LinkChip delayMin={delayMin} t={t} />
        ) : null}
        <Hint label={t.search} kbd="⌘K">
          <CommandTrigger lang={lang} data-tour="search" />
        </Hint>
      </div>
      <CommandMenu lang={lang} crew={crew} />
      <KeyboardShortcuts lang={lang} />
    </header>
  );
}
