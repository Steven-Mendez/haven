import { CircleOff, ServerCrash } from 'lucide-react';
import { Suspense } from 'react';
import { Bar, EmptyState, FirstMission, ListSkeleton, PageContainer } from '@/components/haven';
import { format } from '@/lib/i18n';
import { getTexts } from '@/lib/language';
import { getMissionCode } from '@/lib/mission';
import type { StoredMission } from '@/server/types';
import { EvaPanel } from './components/eva-panel';
import { MedicationPanel } from './components/medication-panel';
import { ReentryPanel } from './components/reentry-panel';
import { RulesPanel } from './components/rules-panel';
import { TrendsPanel } from './components/trends-panel';
import { texts } from './i18n';
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

const TITLES = {
  rules: { title: 'tabRules', subtitle: 'rulesSubtitle' },
  trends: { title: 'tabTrends', subtitle: 'trendsSubtitle' },
  eva: { title: 'tabEva', subtitle: 'evaSubtitle' },
  reentry: { title: 'tabReentry', subtitle: 'reentrySubtitle' },
  medication: { title: 'tabMedication', subtitle: 'medicationSubtitle' },
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

  return (
    <>
      {header}
      {section === 'rules' ? <RulesPanel mission={mission} lang={lang} t={t} /> : null}
      {section === 'trends' ? (
        <TrendsPanel
          mission={code}
          indicator={typeof params.indicator === 'string' ? params.indicator : undefined}
          lang={lang}
          t={t}
        />
      ) : null}
      {section === 'eva' ? <EvaPanel mission={code} lang={lang} t={t} /> : null}
      {section === 'reentry' ? <ReentryPanel mission={mission} lang={lang} t={t} /> : null}
      {section === 'medication' ? <MedicationPanel mission={code} lang={lang} t={t} /> : null}
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
export const TrendsView = ({ searchParams }: PageProps) => (
  <ExtrasPage section="trends" searchParams={searchParams} />
);
export const EvaView = ({ searchParams }: PageProps) => (
  <ExtrasPage section="eva" searchParams={searchParams} />
);

export const ReentryView = ({ searchParams }: PageProps) => (
  <ExtrasPage section="reentry" searchParams={searchParams} />
);

export const MedicationView = ({ searchParams }: PageProps) => (
  <ExtrasPage section="medication" searchParams={searchParams} />
);

export function extrasRedirect(tab: unknown): `/${ExtrasTab}` {
  return `/${(EXTRAS_TABS as readonly unknown[]).includes(tab) ? (tab as ExtrasTab) : 'rules'}`;
}
