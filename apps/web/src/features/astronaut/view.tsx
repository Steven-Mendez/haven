import { ArrowLeft, Inbox, ServerCrash, UserX } from 'lucide-react';
import Link from 'next/link';
import { Suspense } from 'react';
import {
  type AstronautResponse,
  Bar,
  crewMemberLevel,
  EmptyState,
  FirstMission,
  ListSkeleton,
  PageContainer,
  Section,
  type VisualLevel,
} from '@/components/haven';
import { explain } from '@/components/haven/term';
import { buttonVariants } from '@/components/ui/button';
import { format, type Language, minutesBetween } from '@/lib/i18n';
import { getLanguage } from '@/lib/language';
import { getMissionCode } from '@/lib/mission';
import { cn } from '@/lib/utils';
import { AstronautHeader } from './components/astronaut-header';
import { AstronautStates } from './components/astronaut-states';
import { AstronautSummary } from './components/astronaut-summary';
import { NotesList } from './components/notes-list';
import { EmergencyBand, PacketDetail } from './components/packet-detail';
import { PacketList } from './components/packet-list';
import { type TrendOption, TrendsPanel } from './components/trends-panel';
import { VitalTiles } from './components/vital-tiles';
import { type AstronautTexts, texts } from './i18n';
import {
  assessedPacket,
  astronautHref,
  BAR_INDICATORS,
  decimalsFor,
  drawableRange,
  isTab,
  latestCategories,
  latestEmergency,
  latestSources,
  type Names,
  namesFor,
  type Tab,
} from './logic';
import { getAstronaut } from './server';

/** An emergency newer than this is pinned at the top; older ones stay in the timeline. */
export const EMERGENCY_PIN_HOURS = 24;

type RouteProps = {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

type PacketRouteProps = {
  params: Promise<{ id: string; packetId: string }>;
};

/** Trend options: numeric indicators with readings, in zone order, with baseline and normal range. */
function trendOptions(data: AstronautResponse, names: Names, lang: Language): TrendOption[] {
  const byIndicator = new Map(data.assessments.map((a) => [a.indicator, a]));
  const zoneOrder = Object.keys(names.zones);
  return Object.values(names.indicators)
    .filter((i) => i.kind === 'number' && (data.series[i.id]?.length ?? 0) > 0)
    .sort((a, b) => zoneOrder.indexOf(a.zone) - zoneOrder.indexOf(b.zone))
    .map((i) => {
      const points = data.series[i.id] ?? [];
      const values = points.map(([, v]) => v);
      const assessment = byIndicator.get(i.id);
      const degenerate = i.green[1] <= i.green[0];
      return {
        id: i.id,
        name: i.name,
        zone: i.zone,
        zoneName: names.zones[i.zone]?.name ?? i.zone,
        unit: i.unit,
        level: assessment?.level,
        points,
        baseline: assessment?.baseline ?? undefined,
        normalRange: drawableRange(i.green, values) ? i.green : undefined,
        green: degenerate ? undefined : i.green,
        decimals: decimalsFor([...values, ...i.green]),
        kind: (BAR_INDICATORS as readonly string[]).includes(i.id) ? 'bar' : 'line',
        explain: explain(i.id, lang),
        levelMeaning: assessment?.level ? explain(`level-${assessment.level}`, lang) : undefined,
        glossary: {
          baseline: explain('baseline', lang),
          reference: explain('reference-range', lang),
          now: explain('communication-delay', lang),
        },
      };
    });
}

const SEVERITY = { red: 0, amber: 1, pending: 2, green: 3 } as const;

function defaultTrend(options: TrendOption[]): string {
  const sorted = [...options].sort(
    (a, b) => SEVERITY[a.level ?? 'pending'] - SEVERITY[b.level ?? 'pending'],
  );
  const first = sorted[0];
  if (first?.level === 'red' || first?.level === 'amber') return first.id;
  return options.find((o) => o.id === 'heart-rate')?.id ?? options[0]?.id ?? '';
}

/** Indicators shown as tiles first when nothing is flagged. */
const PREFERRED_VITALS = ['heart-rate', 'spo2', 'systolic-bp', 'body-temperature', 'hrv'];

/** Up to four tiles: flagged (red, then amber) first, then the usual vitals, then the rest. */
function vitalOptions(options: TrendOption[]): TrendOption[] {
  const rank = (o: TrendOption) => {
    const severity = SEVERITY[o.level ?? 'pending'];
    const preferred = PREFERRED_VITALS.indexOf(o.id);
    return severity * 100 + (preferred === -1 ? 50 : preferred);
  };
  return [...options].sort((a, b) => rank(a) - rank(b)).slice(0, 4);
}

function BackLink({ t }: { t: AstronautTexts }) {
  return (
    <Link href="/" className={cn(buttonVariants({ variant: 'outline' }), 'hit-area')}>
      <ArrowLeft aria-hidden="true" />
      {t.backToCrew}
    </Link>
  );
}

function AstronautDetail({
  data,
  tab,
  indicator,
  showAllPackets,
  lang,
  t,
}: {
  data: AstronautResponse;
  tab: Tab;
  /** `?indicator=` of the Trends tab (from a Summary tile). */
  indicator?: string;
  showAllPackets: boolean;
  lang: Language;
  t: AstronautTexts;
}) {
  const now = data.generatedAt;
  const member = data.crewMember;
  const names = namesFor(data.mission.environment, lang);
  const assessed = assessedPacket(data);
  const emergency = latestEmergency(data);
  const pinEmergency =
    emergency && minutesBetween(emergency.dataAt, now) < EMERGENCY_PIN_HOURS * 60;
  // Presentation only: an open emergency has priority over the zone assessment in the header and rail.
  const level: VisualLevel = pinEmergency && !member.noRecentData ? 'red' : crewMemberLevel(member);

  let content: React.ReactNode;
  if (tab === 'notes') {
    content = (
      <Section title={t.notesTitle} description={t.notesDescription}>
        <NotesList packets={data.packets} lang={lang} t={t} />
      </Section>
    );
  } else if (data.packets.length === 0) {
    content = (
      <EmptyState
        icon={<Inbox />}
        title={format(t.noPacketsTitle, { name: member.name })}
        description={t.noPacketsDescription}
      />
    );
  } else if (tab === 'states') {
    content = data.assessments.length ? (
      <AstronautStates
        assessments={data.assessments}
        assessedAt={assessed?.dataAt}
        sources={latestSources(data.packets)}
        categories={latestCategories(data.packets)}
        series={data.series}
        now={now}
        stale={member.noRecentData}
        names={names}
        lang={lang}
        t={t}
      />
    ) : (
      <EmptyState title={t.noAssessments} />
    );
  } else if (tab === 'trends') {
    const options = trendOptions(data, names, lang);
    content = options.length ? (
      <TrendsPanel
        options={options}
        defaultId={
          indicator && options.some((o) => o.id === indicator) ? indicator : defaultTrend(options)
        }
        nowAt={Date.parse(now)}
        lang={lang}
        texts={{
          indicator: t.indicator,
          normalRangeText: t.normalRangeText,
          pointsCount: t.pointsCount,
          nowEarth: t.nowEarth,
        }}
      />
    ) : (
      <EmptyState title={t.noTrends} />
    );
  } else if (tab === 'packets') {
    content = (
      <PacketList
        crewMember={member.id}
        packets={data.packets}
        now={now}
        showAll={showAllPackets}
        lang={lang}
        t={t}
      />
    );
  } else {
    const vitals = vitalOptions(trendOptions(data, names, lang));
    content = (
      <div className="flex flex-col gap-6">
        {emergency && pinEmergency ? (
          <EmergencyBand crewMember={member.id} packet={emergency} now={now} lang={lang} t={t} />
        ) : null}
        <AstronautSummary
          data={data}
          assessed={assessed}
          level={level}
          vitals={
            vitals.length ? (
              <VitalTiles
                options={vitals}
                hrefFor={(id) =>
                  `${astronautHref(member.id, 'trends')}&indicator=${encodeURIComponent(id)}`
                }
                stale={member.noRecentData}
                lang={lang}
                texts={{ title: t.vitalsTitle, vsMedian: t.vsMedian, openTrend: t.openTrend }}
              />
            ) : null
          }
          names={names}
          lang={lang}
          t={t}
        />
      </div>
    );
  }

  return (
    <>
      <AstronautHeader data={data} tab={tab} level={level} lang={lang} t={t} />
      {content}
    </>
  );
}

async function loadAstronaut(id: string) {
  const [lang, mission] = await Promise.all([getLanguage(), getMissionCode()]);
  const t = texts[lang];
  const crewMember = decodeURIComponent(id);
  if (!mission) return { lang, t, mission, crewMember, data: null, failed: false as const };
  try {
    const data = await getAstronaut(crewMember, mission);
    return { lang, t, mission, crewMember, data, failed: false as const };
  } catch {
    return { lang, t, mission, crewMember, data: null, failed: true as const };
  }
}

function LoadProblem({
  failed,
  t,
  crewMember,
  mission,
}: {
  failed: boolean;
  t: AstronautTexts;
  crewMember: string;
  mission: string;
}) {
  return failed ? (
    <EmptyState
      icon={<ServerCrash />}
      title={t.errorTitle}
      description={t.errorDescription}
      action={<BackLink t={t} />}
    />
  ) : (
    <EmptyState
      icon={<UserX />}
      title={t.unknownTitle}
      description={format(t.unknownDescription, { id: crewMember, code: mission })}
      action={<BackLink t={t} />}
    />
  );
}

async function AstronautContent({ params, searchParams }: RouteProps) {
  const [{ id }, query] = await Promise.all([params, searchParams]);
  const tab: Tab = isTab(query.tab) ? query.tab : 'summary';
  const loaded = await loadAstronaut(id);
  if (!loaded.mission) return <FirstMission lang={loaded.lang} />;
  if (!loaded.data) return <LoadProblem {...loaded} mission={loaded.mission} />;
  return (
    <AstronautDetail
      data={loaded.data}
      tab={tab}
      indicator={typeof query.indicator === 'string' ? query.indicator : undefined}
      showAllPackets={query.all === '1'}
      lang={loaded.lang}
      t={loaded.t}
    />
  );
}

async function PacketContent({ params }: PacketRouteProps) {
  const { id, packetId } = await params;
  const loaded = await loadAstronaut(id);
  if (!loaded.mission) return <FirstMission lang={loaded.lang} />;
  if (!loaded.data) return <LoadProblem {...loaded} mission={loaded.mission} />;
  const { data, lang, t } = loaded;
  const decodedId = decodeURIComponent(packetId);
  const packet = data.packets.find((p) => p.id === decodedId);
  if (!packet) {
    return (
      <EmptyState
        icon={<Inbox />}
        title={t.packetNotFoundTitle}
        description={format(t.packetNotFoundDescription, { id: decodedId })}
        action={<BackLink t={t} />}
      />
    );
  }
  return (
    <PacketDetail
      crewMember={data.crewMember.id}
      crewMemberName={data.crewMember.name}
      packet={packet}
      now={data.generatedAt}
      names={namesFor(data.mission.environment, lang)}
      lang={lang}
      t={t}
    />
  );
}

/** Same footprint as the Summary tab: header, tabs, tiles + chart, list, and the 300 px rail. */
function AstronautSkeleton() {
  return (
    <div className="flex flex-col gap-6" aria-busy="true">
      <div className="flex flex-col gap-4">
        <div className="flex items-center gap-3">
          <Bar className="size-9 rounded-full" />
          <div className="flex flex-col gap-2">
            <Bar className="h-4 w-40" />
            <Bar className="w-64" />
          </div>
        </div>
        <div className="flex h-9 items-center gap-6 border-b">
          {['w-14', 'w-12', 'w-16', 'w-14', 'w-12'].map((w, i) => (
            // biome-ignore lint/suspicious/noArrayIndexKey: static placeholders
            <Bar key={i} className={w} />
          ))}
        </div>
      </div>
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_300px]">
        <div className="flex flex-col gap-6">
          <div className="overflow-hidden rounded-xl border">
            <div className="bg-border grid grid-cols-2 gap-px border-b sm:grid-cols-4">
              {[0, 1, 2, 3].map((i) => (
                <div
                  key={i}
                  className="bg-background md:bg-surface flex flex-col gap-3 px-4 py-3.5"
                >
                  <Bar className="w-20" />
                  <Bar className="h-5 w-14" />
                </div>
              ))}
            </div>
            <div className="h-52" />
          </div>
          <ListSkeleton rows={4} />
        </div>
        <div className="flex h-56 flex-col gap-4 rounded-xl border p-4">
          {[0, 1, 2, 3, 4].map((i) => (
            <div key={i} className="flex justify-between">
              <Bar className="w-16" />
              <Bar className="w-20" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

/** T02 · `/astronaut/[id]?tab=`: static frame plus a Suspense boundary with the request-time content. */
export function View(props: RouteProps) {
  return (
    <PageContainer className="gap-6">
      <Suspense fallback={<AstronautSkeleton />}>
        <AstronautContent {...props} />
      </Suspense>
    </PageContainer>
  );
}

/** T02 · `/astronaut/[id]/packet/[packetId]`: one received packet on its own page. */
export function PacketView(props: PacketRouteProps) {
  return (
    <PageContainer className="gap-6">
      <Suspense fallback={<AstronautSkeleton />}>
        <PacketContent {...props} />
      </Suspense>
    </PageContainer>
  );
}
