import { loadConfig, unitLabel } from '@haven/core';
import { CircleOff, ServerCrash, UserCog, X } from 'lucide-react';
import Link from 'next/link';
import { Suspense } from 'react';
import {
  type CrewCard,
  CrewList,
  CrewPageSkeleton,
  CrewPeekProvider,
  type CrewResponse,
  EmptyState,
  FirstMission,
  havenTexts,
  MissionHeader,
  PageContainer,
  type Stat,
  StatStrip,
} from '@/components/haven';
import { buttonVariants } from '@/components/ui/button';
import { Kbd } from '@/components/ui/kbd';
import { format, type Language, translate } from '@/lib/i18n';
import { getLanguage } from '@/lib/language';
import { getMissionCode } from '@/lib/mission';
import { AutoRefresh } from './components/auto-refresh';
import { RosterManager, WaitingCrew } from './components/crew-roster';
import { EmergencyInbox } from './components/emergency-inbox';
import { StartMission } from './components/start-mission';
import { texts } from './i18n';
import { rosterOf } from './roster';
import { earthUrlForPhones, getCrew } from './server';

export const REFRESH_INTERVAL_SEC = 5;

type Names = {
  environmentName?: string;
  zoneNames: Record<string, string>;
  indicators: Record<string, { name: string; unit: string }>;
};

function namesFor(environment: string, lang: Language): Names {
  const config = loadConfig();
  const env = config.environments.find((e) => e.id === environment);
  return {
    environmentName: env ? translate(env.name, lang) : undefined,
    zoneNames: Object.fromEntries(config.zones.map((z) => [z.id, translate(z.name, lang)])),
    indicators: Object.fromEntries(
      config.indicators.map((i) => [
        i.id,
        { name: translate(i.name, lang), unit: unitLabel(i.unit, lang) },
      ]),
    ),
  };
}

function rolesFor(crew: CrewResponse['crew'], lang: Language): Record<string, string> {
  return Object.fromEntries(
    crew.flatMap((m) => (m.role ? [[m.id, translate(m.role, lang)] as const] : [])),
  );
}

const FILTERS = ['amber', 'red', 'stale'] as const;
type CrewFilter = (typeof FILTERS)[number];

function parseFilter(value: string | string[] | undefined): CrewFilter | undefined {
  return FILTERS.find((f) => f === value);
}

function matchesFilter(member: CrewCard, filter: CrewFilter) {
  if (filter === 'stale') return member.noRecentData;
  return member.zones.some((z) => z.level === filter);
}

const filterHref = (f: CrewFilter, active?: CrewFilter) => (f === active ? '/' : `/?filter=${f}`);

function summaryStats(
  data: CrewResponse,
  crew: CrewCard[],
  lang: Language,
  filter?: CrewFilter,
): Stat[] {
  const t = texts[lang];
  const { summary } = data;
  const stale = crew.filter((m) => m.noRecentData).length;
  const tile = (f: CrewFilter, value: number) =>
    value > 0 || filter === f ? { href: filterHref(f, filter), active: filter === f } : {};
  return [
    { label: t.statActions, value: summary.actionsDone, unit: `/${summary.actionsTotal}` },
    {
      label: t.statAmber,
      value: summary.amberZones,
      level: summary.amberZones > 0 ? 'amber' : undefined,
      ...tile('amber', summary.amberZones),
    },
    {
      label: t.statRed,
      value: summary.redZones,
      level: summary.redZones > 0 ? 'red' : undefined,
      ...tile('red', summary.redZones),
    },
    {
      label: t.statNoRecentData,
      value: stale,
      level: stale > 0 ? 'no-data' : undefined,
      ...tile('stale', stale),
    },
  ];
}

const filterLabel = (f: CrewFilter, lang: Language) => {
  const t = texts[lang];
  return f === 'amber' ? t.statAmber : f === 'red' ? t.statRed : t.statNoRecentData;
};

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

async function CrewContent({ searchParams }: { searchParams: SearchParams }) {
  const [lang, code, params] = await Promise.all([getLanguage(), getMissionCode(), searchParams]);
  const filter = parseFilter(params.filter);
  const t = texts[lang];
  if (!code) return <FirstMission lang={lang} />;

  let data: CrewResponse | null;
  try {
    data = await getCrew(code);
  } catch {
    return (
      <EmptyState icon={<ServerCrash />} title={t.errorTitle} description={t.errorDescription} />
    );
  }

  if (!data) {
    return (
      <EmptyState
        icon={<CircleOff />}
        title={t.unknownMissionTitle}
        description={format(t.unknownMissionDescription, { code })}
      />
    );
  }

  const now = data.generatedAt;
  const names = namesFor(data.mission.environment, lang);
  const header = (
    <div data-tour="header">
      <MissionHeader
        mission={data.mission}
        now={now}
        lang={lang}
        environmentName={names.environmentName}
        actions={
          data.mission.status === 'planned' || data.mission.status === 'scheduled' ? (
            <StartMission
              mission={code}
              scheduled={data.mission.status === 'scheduled'}
              ready={data.crew.filter((c) => c.joinedAt !== null || c.lastPacket !== null).length}
              total={data.crew.length}
              lang={lang}
            />
          ) : undefined
        }
      />
    </div>
  );

  const earthUrl = await earthUrlForPhones();
  const roster = await rosterOf(data.crew, code, earthUrl, lang);

  if (!data.mission.lastDataAt) {
    return (
      <>
        {header}
        <section
          aria-labelledby="crew-setup-title"
          className="flex flex-col gap-4 rounded-xl border p-5"
        >
          <div className="flex flex-col gap-1.5">
            <h2 id="crew-setup-title" className="text-sm font-semibold">
              {t.rosterSetupTitle}
            </h2>
            <p className="text-muted-foreground max-w-prose text-sm leading-6">
              {t.rosterSetupBody}
            </p>
          </div>
        </section>
        <RosterManager
          mission={code}
          earthUrl={earthUrl}
          members={roster}
          now={data.generatedAt}
          lang={lang}
          readOnly={data.mission.status === 'finished'}
        />
      </>
    );
  }

  const crew = data.crew.filter((m) => m.lastPacket !== null);
  const shown = filter ? crew.filter((m) => matchesFilter(m, filter)) : crew;
  const roles = rolesFor(crew, lang);
  const h = havenTexts[lang];

  return (
    <>
      {header}
      <div data-tour="stats">
        <StatStrip items={summaryStats(data, crew, lang, filter)} lang={lang} />
      </div>

      <CrewPeekProvider
        members={crew}
        now={now}
        lang={lang}
        roles={roles}
        zoneNames={names.zoneNames}
        indicators={names.indicators}
      >
        <section
          aria-labelledby="crew-title"
          data-tour="crew"
          className="flex min-w-0 flex-col gap-2"
        >
          <div className="flex items-center justify-between gap-3">
            <div className="flex min-w-0 items-center gap-2">
              <h2 id="crew-title" className="text-sm font-semibold">
                {t.title}
                <span className="text-tertiary ml-2 font-normal tabular-nums">
                  {filter
                    ? format(t.filterShowing, { n: shown.length, total: crew.length })
                    : crew.length}
                </span>
              </h2>
              {filter ? (
                <Link
                  href="/"
                  scroll={false}
                  aria-label={`${t.clearFilter}: ${filterLabel(filter, lang)}`}
                  className="bg-hover hover:bg-active text-muted-foreground hover:text-foreground inline-flex h-6 items-center gap-1 rounded-md border px-2 text-xs transition-colors"
                >
                  {filterLabel(filter, lang)}
                  <X aria-hidden="true" className="size-3" />
                </Link>
              ) : null}
            </div>
            <div className="flex items-center gap-3">
              <p className="text-tertiary hidden items-center gap-1.5 text-xs md:flex">
                <Kbd>j</Kbd>
                <Kbd>k</Kbd>
                <Kbd>↵</Kbd>
                <span className="sr-only">{h.keyboardHint}</span>
              </p>
              <Link href="/crew" className={buttonVariants({ variant: 'outline', size: 'sm' })}>
                <UserCog data-icon="inline-start" />
                {t.rosterManage}
              </Link>
            </div>
          </div>
          <CrewList
            members={shown}
            now={now}
            lang={lang}
            roles={roles}
            zoneNames={names.zoneNames}
            indicators={names.indicators}
            delayMin={data.mission.delayMin}
          />
        </section>

        <WaitingCrew members={roster.filter((m) => m.waiting)} lang={lang} />

        <EmergencyInbox
          crew={crew}
          now={now}
          lang={lang}
          roles={roles}
          indicators={names.indicators}
          delayMin={data.mission.delayMin}
        />
      </CrewPeekProvider>
    </>
  );
}

export function View({ searchParams }: { searchParams: SearchParams }) {
  return (
    <PageContainer>
      <AutoRefresh intervalSec={REFRESH_INTERVAL_SEC} />
      <Suspense fallback={<CrewPageSkeleton />}>
        <CrewContent searchParams={searchParams} />
      </Suspense>
    </PageContainer>
  );
}
