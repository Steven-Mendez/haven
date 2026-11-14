import { ServerCrash } from 'lucide-react';
import { Suspense } from 'react';
import {
  CrewPageSkeleton,
  EmptyState,
  FirstMission,
  PageContainer,
  StatStrip,
} from '@/components/haven';
import { format } from '@/lib/i18n';
import { getLanguage } from '@/lib/language';
import { getMissionCode } from '@/lib/mission';
import { AutoRefresh } from './components/auto-refresh';
import { RosterManager } from './components/crew-roster';
import { texts } from './i18n';
import { rosterOf } from './roster';
import { earthUrlForPhones, getCrew } from './server';

const ROSTER_REFRESH_SEC = 5;

async function RosterContent() {
  const [lang, code] = await Promise.all([getLanguage(), getMissionCode()]);
  const t = texts[lang];
  if (!code) return <FirstMission lang={lang} />;

  const data = await getCrew(code).catch(() => null);
  if (!data) {
    return (
      <EmptyState icon={<ServerCrash />} title={t.errorTitle} description={t.errorDescription} />
    );
  }
  const earthUrl = await earthUrlForPhones();
  const roster = await rosterOf(data.crew, code, earthUrl, lang);
  const sending = roster.filter((m) => !m.waiting).length;

  return (
    <>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="flex flex-col gap-1">
          <h1 className="text-xl font-semibold tracking-[-0.01em]">{t.manageTitle}</h1>
          <p className="text-muted-foreground text-xs">
            {format(t.manageSubtitle, { mission: data.mission.name })}
          </p>
        </div>
      </div>
      <StatStrip
        lang={lang}
        items={[
          { label: t.statTotal, value: roster.length },
          { label: t.statSending, value: sending },
          { label: t.statInvited, value: roster.length - sending },
          { label: t.statWatch, value: roster.filter((m) => m.hasWatch).length },
        ]}
      />
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

export function RosterView() {
  return (
    <PageContainer>
      <AutoRefresh intervalSec={ROSTER_REFRESH_SEC} />
      <Suspense fallback={<CrewPageSkeleton />}>
        <RosterContent />
      </Suspense>
    </PageContainer>
  );
}
