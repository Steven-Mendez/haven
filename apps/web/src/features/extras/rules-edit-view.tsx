import { isTracked, loadConfig, unitLabel } from '@haven/core';
import { CircleOff } from 'lucide-react';
import Link from 'next/link';
import { Suspense } from 'react';
import { EmptyState, FirstMission, havenTexts, PageContainer } from '@/components/haven';
import { buttonVariants } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { format, translate } from '@/lib/i18n';
import { getTexts } from '@/lib/language';
import { getMissionCode } from '@/lib/mission';
import { RulesEditor } from './components/rules-editor';
import { texts } from './i18n';
import { rangeControlFor } from './logic/range-control';
import { editableIndicators } from './logic/rules';
import { getCurrentConfig, getMission, listRules } from './server';

const BACK = '/rules';

function EditSkeleton() {
  return (
    <div className="flex max-w-2xl flex-col gap-6" aria-busy="true">
      <Skeleton className="h-8 w-64" />
      <Skeleton className="h-28 rounded-xl" />
      <Skeleton className="h-40 rounded-xl" />
    </div>
  );
}

async function RulesEditContent({ params }: { params: Promise<{ indicator: string }> }) {
  const [{ indicator: raw }, { lang, t }, code] = await Promise.all([
    params,
    getTexts(texts),
    getMissionCode(),
  ]);
  if (!code) return <FirstMission lang={lang} />;
  const backLink = (
    <Link href={BACK} className={buttonVariants({ variant: 'outline' })}>
      {t.backToThresholds}
    </Link>
  );
  const mission = await getMission(code);
  if (!mission) {
    return (
      <EmptyState
        icon={<CircleOff />}
        title={t.unknownMission}
        description={format(t.unknownMissionDetail, { mission: code })}
        action={backLink}
      />
    );
  }
  const { versions } = await listRules(code);
  const { config, fromVersion } = await getCurrentConfig(code, versions);
  const id = decodeURIComponent(raw);
  const found = editableIndicators(config).find((i) => i.id === id && isTracked(i.id));
  if (!found) {
    return <EmptyState icon={<CircleOff />} title={t.indicatorNotFound} action={backLink} />;
  }
  const indicator = { ...found, unit: unitLabel(found.unit, lang) };
  const control = rangeControlFor(found);
  const environmentNames = Object.fromEntries(
    loadConfig().environments.map((e) => [e.id, translate(e.name, lang)]),
  );

  return (
    <>
      <header className="flex max-w-2xl flex-col gap-1">
        <h1 className="text-xl font-semibold tracking-[-0.01em]">
          {t.editorTitle} · {translate(indicator.name, lang)}
        </h1>
        <p className="text-muted-foreground text-xs">
          {format(t.editorDescription, { version: fromVersion?.version ?? config.version })}
        </p>
      </header>
      <RulesEditor
        control={control}
        lang={lang}
        indicator={indicator}
        environmentNames={environmentNames}
        author={havenTexts[lang].operatorName}
        backHref={BACK}
      />
    </>
  );
}

export function RulesEditView({ params }: { params: Promise<{ indicator: string }> }) {
  return (
    <PageContainer>
      <Suspense fallback={<EditSkeleton />}>
        <RulesEditContent params={params} />
      </Suspense>
    </PageContainer>
  );
}
