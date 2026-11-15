import { CircleOff, ServerCrash } from 'lucide-react';
import Link from 'next/link';
import { Suspense } from 'react';
import { Bar, EmptyState, FirstMission, ListSkeleton, PageContainer } from '@/components/haven';
import { format } from '@/lib/i18n';
import { getTexts } from '@/lib/language';
import { getMissionCode } from '@/lib/mission';
import { cn } from '@/lib/utils';
import type { StoredMission } from '@/server/types';
import { EvaPanel } from './components/eva-panel';
import { ExercisePanel } from './components/exercise-panel';
import { KpiDashboardPanel } from './components/kpi/kpi-dashboard-panel';
import { MedicationPanel } from './components/medication-panel';
import { RulesPanel } from './components/rules-panel';
import { TrendsPanel } from './components/trends-panel';
import { type ExtrasTexts, texts } from './i18n';
import { getMission } from './server';
import { EXTRAS_TABS, type ExtrasTab } from './types';

export type SearchParams = Promise<Record<string, string | string[] | undefined>>;

function ExtrasSkeleton() {
  return (
    <div className="flex flex-col gap-6" aria-busy="true">
      <div className="flex flex-col gap-2.5 py-1">
        <Bar className="h-4 w-40" />
        <Bar className="w-80 max-w-full" />
      </div>
      <ListSkeleton rows={8} />
    </div>
  );
}

function KpiViewSwitch({
  individual,
  indicator,
  t,
}: {
  individual: boolean;
  indicator: string | undefined;
  t: ExtrasTexts;
}) {
  const items = [
    { href: '/kpi', label: t.kpiViewDashboard, active: !individual },
    {
      href: `/kpi?view=individual${indicator ? `&indicator=${encodeURIComponent(indicator)}` : ''}`,
      label: t.kpiViewIndividual,
      active: individual,
    },
  ];
  return (
    <nav aria-label={t.kpiViews} className="flex h-7 w-fit items-center rounded-md border p-0.5">
      {items.map((item) => (
        <Link
          key={item.href}
          href={item.href}
          scroll={false}
          aria-current={item.active ? 'page' : undefined}
          className={cn(
            'hover:text-foreground flex h-6 items-center rounded-sm px-2 text-xs font-medium transition-colors',
            item.active ? 'bg-active text-foreground' : 'text-muted-foreground',
          )}
        >
          {item.label}
        </Link>
      ))}
    </nav>
  );
}

const TITLES = {
  rules: { title: 'tabRules', subtitle: 'rulesSubtitle' },
  kpi: { title: 'kpiTitle', subtitle: 'kpiSubtitle' },
  eva: { title: 'tabEva', subtitle: 'evaSubtitle' },
  medication: { title: 'tabMedication', subtitle: 'medicationSubtitle' },
  exercise: { title: 'tabExercise', subtitle: 'exerciseSubtitle' },
} as const;

async function ExtrasContent({
  section,
  searchParams,
}: {
  section: ExtrasTab;
  searchParams: SearchParams;
}) {
  const [{ lang, t }, code, params] = await Promise.all([
    getTexts(texts),
    getMissionCode(),
    searchParams,
  ]);
  if (!code) return <FirstMission lang={lang} />;
  let mission: StoredMission | null;
  try {
    mission = await getMission(code);
  } catch {
    return (
      <EmptyState icon={<ServerCrash />} title={t.loadError} description={t.loadErrorDetail} />
    );
  }

  const indicator = typeof params.indicator === 'string' ? params.indicator : undefined;
  const individual = params.view === 'individual';
  const header = (
    <div className="flex flex-col gap-1">
      <h1 className="text-xl font-semibold tracking-[-0.01em]">{t[TITLES[section].title]}</h1>
      <p className="text-muted-foreground text-xs">
        {format(t[TITLES[section].subtitle], {
          mission: mission?.name ?? code,
        })}
      </p>
    </div>
  );
  if (!mission) {
    return (
      <>
        {header}
        <EmptyState
          icon={<CircleOff />}
          title={t.unknownMission}
          description={format(t.unknownMissionDetail, { mission: code })}
        />
      </>
    );
  }

  if (section === 'kpi') {
    const top = (
      <div className="flex flex-col gap-4">
        {header}
        <KpiViewSwitch individual={individual} indicator={indicator} t={t} />
      </div>
    );
    return (
      <>
        {top}
        {individual ? (
          <TrendsPanel mission={code} indicator={indicator} lang={lang} t={t} />
        ) : (
          <KpiDashboardPanel mission={code} lang={lang} t={t} />
        )}
      </>
    );
  }

  return (
    <>
      {header}
      {section === 'rules' ? <RulesPanel mission={mission} lang={lang} t={t} /> : null}
      {section === 'eva' ? <EvaPanel mission={code} lang={lang} t={t} /> : null}
      {section === 'medication' ? <MedicationPanel mission={code} lang={lang} t={t} /> : null}
      {section === 'exercise' ? <ExercisePanel mission={code} lang={lang} t={t} /> : null}
    </>
  );
}

function ExtrasPage({ section, searchParams }: { section: ExtrasTab; searchParams: SearchParams }) {
  return (
    <PageContainer>
      <Suspense fallback={<ExtrasSkeleton />}>
        <ExtrasContent section={section} searchParams={searchParams} />
      </Suspense>
    </PageContainer>
  );
}

type PageProps = { searchParams: SearchParams };

export const RulesView = ({ searchParams }: PageProps) => (
  <ExtrasPage section="rules" searchParams={searchParams} />
);
export const KpiView = ({ searchParams }: PageProps) => (
  <ExtrasPage section="kpi" searchParams={searchParams} />
);
export const EvaView = ({ searchParams }: PageProps) => (
  <ExtrasPage section="eva" searchParams={searchParams} />
);

export const MedicationView = ({ searchParams }: PageProps) => (
  <ExtrasPage section="medication" searchParams={searchParams} />
);

export const ExerciseView = ({ searchParams }: PageProps) => (
  <ExtrasPage section="exercise" searchParams={searchParams} />
);

export function extrasRedirect(tab: unknown): `/${ExtrasTab}` {
  if (tab === 'trends') return '/kpi';
  return `/${(EXTRAS_TABS as readonly unknown[]).includes(tab) ? (tab as ExtrasTab) : 'rules'}`;
}
