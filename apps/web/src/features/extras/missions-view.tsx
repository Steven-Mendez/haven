import { Suspense } from 'react';
import { PageContainer } from '@/components/haven';
import { Skeleton } from '@/components/ui/skeleton';
import { getTexts } from '@/lib/language';
import { getMissionCode } from '@/lib/mission';
import { MissionsPanel } from './components/missions-panel';
import { texts } from './i18n';

function MissionsSkeleton() {
  return (
    <div className="flex flex-col gap-8">
      <Skeleton className="h-8 w-48" />
      <div className="grid gap-6 lg:grid-cols-[3fr_2fr]">
        <Skeleton className="h-96 rounded-xl" />
        <Skeleton className="h-56 rounded-xl" />
      </div>
      <Skeleton className="h-40 rounded-xl" />
    </div>
  );
}

async function MissionsContent() {
  const [{ lang, t }, code] = await Promise.all([getTexts(texts), getMissionCode()]);
  return <MissionsPanel current={code ?? ''} lang={lang} t={t} />;
}

export function MissionsView() {
  return (
    <PageContainer>
      <Suspense fallback={<MissionsSkeleton />}>
        <MissionsContent />
      </Suspense>
    </PageContainer>
  );
}
