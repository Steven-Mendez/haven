import { connection } from 'next/server';
import { Suspense } from 'react';
import { PageContainer } from '@/components/haven';
import { Skeleton } from '@/components/ui/skeleton';
import { translate } from '@/lib/i18n';
import { getTexts } from '@/lib/language';
import { CreateMissionForm } from './components/create-mission-form';
import { texts } from './i18n';
import { planOptions } from './logic/plan-options';

function NewMissionSkeleton() {
  return (
    <div className="flex flex-col gap-6">
      <Skeleton className="h-6 w-80" />
      <div className="grid gap-6 lg:grid-cols-[320px_1fr]">
        <Skeleton className="h-96 rounded-xl" />
        <Skeleton className="h-[28rem] rounded-xl" />
      </div>
    </div>
  );
}

async function NewMissionContent() {
  await connection();
  const { lang, t } = await getTexts(texts);
  const { environments, templates } = planOptions(lang);
  const envName = (id: string) => environments.find((e) => e.id === id)?.name ?? id;
  return (
    <>
      <header>
        <div className="flex max-w-2xl flex-col gap-1">
          <h1 className="text-xl font-semibold tracking-[-0.01em]">{t.newMission}</h1>
          <p className="text-muted-foreground text-sm">{t.newMissionLead}</p>
        </div>
      </header>
      <CreateMissionForm
        lang={lang}
        templates={templates.map((tpl) => ({
          ...tpl,
          phaseNames: tpl.phases.map((p) =>
            p.label ? translate(p.label, lang) : envName(p.environment),
          ),
        }))}
      />
    </>
  );
}

/** T03 · «New mission» (`/missions/new`): a name and an optional base plan; the rest is set up on its page. */
export function NewMissionView() {
  return (
    <PageContainer>
      <Suspense fallback={<NewMissionSkeleton />}>
        <NewMissionContent />
      </Suspense>
    </PageContainer>
  );
}
