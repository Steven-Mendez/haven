import type { Metadata, Viewport } from 'next';
import { cache, Suspense } from 'react';
import { AppHeader, AppHeaderSkeleton } from '@/components/app-header';
import { AppSidebar, MissionSwitcherSkeleton, NavOperatorSkeleton } from '@/components/app-sidebar';
import { crewDisplayLevel, hasOpenEmergency } from '@/components/haven/astronaut-card';
import { fontSans } from '@/components/haven/fonts';
import { THEME_SCRIPT } from '@/components/haven/theme';
import { MissionSwitcher } from '@/components/mission-switcher';
import { NavMain, NavMainSkeleton } from '@/components/nav-main';
import { NavOperator } from '@/components/nav-operator';
import { ProductTour } from '@/components/product-tour';
import { SidebarInset, SidebarProvider } from '@/components/ui/sidebar';
import { Toaster } from '@/components/ui/sonner';
import { TooltipProvider } from '@/components/ui/tooltip';
import { getCrew } from '@/features/crew/server';
import { listMissions } from '@/features/extras/server';
import { DEFAULT_LANGUAGE } from '@/lib/i18n';
import { getLanguage } from '@/lib/language';
import { getMissionCode } from '@/lib/mission';
import { cn } from '@/lib/utils';
import './globals.css';

export const metadata: Metadata = {
  title: 'HAVEN · Vista de Tierra / Ground View',
  description:
    'Control de misión: estado de la tripulación con el retardo real de la misión. Mission control: crew status with the real mission delay.',
  icons: { icon: '/brand/haven-mark.svg' },
};

export const viewport: Viewport = {
  // Edge to edge on iPhone; the shell pads itself with env(safe-area-inset-*) (EQUIPOS.md · Safe areas).
  viewportFit: 'cover',
  colorScheme: 'dark',
  themeColor: [
    { media: '(prefers-color-scheme: dark)', color: '#000000' },
    { media: '(prefers-color-scheme: light)', color: '#ffffff' },
  ],
};

// One read per request, shared by the sidebar and the header. Errors (e.g. MongoDB down) degrade to
// "no data" instead of breaking the shell.
const loadShell = cache(async () => {
  const [lang, code] = await Promise.all([getLanguage(), getMissionCode()]);
  const [crew, missions] = await Promise.all([
    code ? getCrew(code).catch(() => null) : null,
    listMissions().catch(() => ({ missions: [] })),
  ]);
  return { lang, code, crew, missions: missions.missions };
});

async function MissionSwitcherWithData() {
  const { lang, code, missions } = await loadShell();
  return (
    <MissionSwitcher
      lang={lang}
      active={code}
      missions={missions.map((m) => ({ code: m.code, name: m.name }))}
    />
  );
}

async function NavMainWithData() {
  const { lang, crew } = await loadShell();
  return (
    <NavMain
      lang={lang}
      crew={(crew?.crew ?? []).map((m) => ({
        id: m.id,
        name: m.name,
        level: crewDisplayLevel(m),
        emergency: hasOpenEmergency(m),
      }))}
    />
  );
}

async function NavOperatorWithData() {
  const { lang } = await loadShell();
  return <NavOperator lang={lang} />;
}

async function ProductTourWithData() {
  const { lang } = await loadShell();
  return <ProductTour lang={lang} />;
}

async function HeaderWithData() {
  const { lang, crew } = await loadShell();
  const members = crew?.crew ?? [];
  return (
    <AppHeader
      lang={lang}
      day={crew?.mission.day}
      linkDown={crew?.mission.linkDown}
      crewNames={Object.fromEntries(members.map((m) => [m.id, m.name]))}
      crew={members.map((m) => ({ id: m.id, name: m.name, level: crewDisplayLevel(m) }))}
    />
  );
}

// Dashboard shell: SidebarProvider + AppSidebar (inset variant) + SidebarInset (the bordered content panel).
// Language, mission and crew come from cookies and the database (request time), so the sidebar and the
// header stream inside <Suspense> with a default-language fallback. Pages read the language with getLanguage().
export default function RootLayout({ children }: LayoutProps<'/'>) {
  return (
    <html
      lang={DEFAULT_LANGUAGE}
      className={cn('dark h-full antialiased', fontSans.variable)}
      suppressHydrationWarning
    >
      <head>
        {/* biome-ignore lint/security/noDangerouslySetInnerHtml: static theme bootstrap, no user input */}
        <script dangerouslySetInnerHTML={{ __html: THEME_SCRIPT }} />
      </head>
      <body className="min-h-full font-sans">
        <TooltipProvider>
          <SidebarProvider>
            <AppSidebar
              header={
                <div data-tour="mission">
                  <Suspense fallback={<MissionSwitcherSkeleton />}>
                    <MissionSwitcherWithData />
                  </Suspense>
                </div>
              }
              footer={
                <Suspense fallback={<NavOperatorSkeleton />}>
                  <NavOperatorWithData />
                </Suspense>
              }
            >
              <div data-tour="nav">
                <Suspense fallback={<NavMainSkeleton />}>
                  <NavMainWithData />
                </Suspense>
              </div>
            </AppSidebar>
            <SidebarInset className="min-w-0">
              <Suspense fallback={<AppHeaderSkeleton />}>
                <HeaderWithData />
              </Suspense>
              <div id="content" className="flex flex-1 flex-col">
                {children}
              </div>
            </SidebarInset>
          </SidebarProvider>
          <Toaster />
          <Suspense>
            <ProductTourWithData />
          </Suspense>
        </TooltipProvider>
      </body>
    </html>
  );
}
