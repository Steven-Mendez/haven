import { phaseAt } from '@haven/core';
import { CircleOff, Lock, Pencil, Users } from 'lucide-react';
import Link from 'next/link';
import { connection } from 'next/server';
import { Suspense } from 'react';
import { EmptyState, PageContainer } from '@/components/haven';
import { Button, buttonVariants } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { format, formatDate, type Language, translate } from '@/lib/i18n';
import { getTexts } from '@/lib/language';
import { cn } from '@/lib/utils';
import type { MissionStatus, StoredMission } from '@/server/types';
import { openMissionAt, saveMissionPlanAction } from './actions';
import { MissionBuilder, type StartMode } from './components/mission-builder';
import { MissionLifecycle } from './components/mission-lifecycle';
import { PhaseBar } from './components/phase-bar';
import { RenameMission } from './components/rename-mission';
import { type ExtrasTexts, texts } from './i18n';
import { planOptions } from './logic/plan-options';
import { getMission } from './server';

const isPreparing = (s: MissionStatus) => s === 'planned' || s === 'scheduled';

function StatusBadge({ status, t }: { status: MissionStatus; t: ExtrasTexts }) {
  const label = isPreparing(status)
    ? t.statusPreparation
    : status === 'active'
      ? t.statusRunning
      : t.statusFinished;
  return (
    <span
      className={cn(
        'inline-flex h-6 items-center gap-1.5 rounded-md border px-2 text-xs whitespace-nowrap',
        isPreparing(status) && 'border-dashed',
        status === 'finished' && 'text-muted-foreground',
      )}
    >
      <span
        aria-hidden="true"
        className={cn(
          'size-1.5 rounded-full',
          status === 'active' ? 'bg-brand' : 'border-tertiary border border-dashed',
        )}
      />
      {label}
    </span>
  );
}

function statusHint(m: StoredMission, status: MissionStatus, lang: Language, t: ExtrasTexts) {
  if (status === 'planned') return t.statusPlannedHint;
  if (status === 'scheduled')
    return format(t.statusScheduledHint, { date: formatDate(m.start, lang) });
  if (status === 'active')
    return format(t.statusRunningHint, { day: m.day, total: m.durationDays });
  return format(t.statusFinishedHint, { date: formatDate(m.finishedAt ?? m.start, lang) });
}

function startText(m: StoredMission, status: MissionStatus, lang: Language, t: ExtrasTexts) {
  if (status === 'planned') return t.startWhenIStart;
  if (status === 'scheduled') return format(t.startOnDate, { date: formatDate(m.start, lang) });
  return format(t.startedOn, { date: formatDate(m.start, lang) });
}

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="flex flex-col gap-3 rounded-xl border p-4">
      <h2 className="text-sm font-semibold">{title}</h2>
      {children}
    </section>
  );
}

function MissionSkeleton() {
  return (
    <div className="flex flex-col gap-6">
      <Skeleton className="h-8 w-64" />
      <Skeleton className="h-28 rounded-xl" />
      <div className="grid gap-4 md:grid-cols-2">
        <Skeleton className="h-40 rounded-xl" />
        <Skeleton className="h-40 rounded-xl" />
      </div>
    </div>
  );
}

function NotFound({ code, t }: { code: string; t: ExtrasTexts }) {
  return (
    <EmptyState
      icon={<CircleOff />}
      title={format(t.missionNotFound, { code })}
      action={
        <Link href="/missions" className={buttonVariants({ variant: 'outline' })}>
          {t.backToList}
        </Link>
      }
    />
  );
}

async function MissionContent({ params }: { params: Promise<{ code: string }> }) {
  const [{ code: raw }, { lang, t }] = await Promise.all([params, getTexts(texts)]);
  const code = decodeURIComponent(raw).toUpperCase();
  const mission = await getMission(code);
  if (!mission) return <NotFound code={code} t={t} />;
  const status = mission.status ?? 'active';
  const preparing = isPreparing(status);
  const { environments } = planOptions(lang);
  const phases = mission.phases ?? [];
  const names = phases.map((p) =>
    p.label
      ? translate(p.label, lang)
      : (environments.find((e) => e.id === p.environment)?.name ?? p.environment),
  );
  const current =
    status === 'active' && phases.length ? phaseAt(phases, mission.day)?.index : undefined;

  return (
    <>
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex min-w-0 flex-col gap-1.5">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-xl font-semibold tracking-[-0.01em]">{mission.name}</h1>
            <StatusBadge status={status} t={t} />
          </div>
          <p className="text-muted-foreground max-w-prose text-sm leading-6">
            {statusHint(mission, status, lang, t)}
          </p>
        </div>
        <MissionLifecycle code={code} status={status} lang={lang} />
      </header>

      <div className="grid gap-4 md:grid-cols-2">
        <Card title={t.sectionName}>
          <RenameMission
            code={code}
            name={mission.name}
            disabled={status === 'finished'}
            lang={lang}
          />
        </Card>

        <Card title={t.sectionStart}>
          <p className="text-sm">{startText(mission, status, lang, t)}</p>
          {preparing ? (
            <Link
              href={`/missions/${code}/plan`}
              className={cn(buttonVariants({ variant: 'outline', size: 'sm' }), 'self-start')}
            >
              <Pencil data-icon="inline-start" />
              {t.editPlan}
            </Link>
          ) : null}
        </Card>

        <Card title={t.sectionPlan}>
          {phases.length ? (
            <>
              <PhaseBar phases={phases} names={names} current={current} />
              <p className="text-muted-foreground text-xs tabular-nums">
                {format(t.daysTotal, { n: mission.durationDays })} ·{' '}
                {format(t.phasesCount, { n: phases.length })}
              </p>
              <ol className="text-muted-foreground flex flex-col gap-0.5 text-xs">
                {phases.map((p, i) => (
                  // biome-ignore lint/suspicious/noArrayIndexKey: phases are positional
                  <li key={i} className={cn(i === current && 'text-foreground font-medium')}>
                    {i + 1}. {names[i]} ·{' '}
                    {p.days === 1 ? t.oneDay : format(t.daysTotal, { n: p.days })}
                  </li>
                ))}
              </ol>
            </>
          ) : null}
          {preparing ? (
            <Link
              href={`/missions/${code}/plan`}
              className={cn(buttonVariants({ variant: 'outline', size: 'sm' }), 'self-start')}
            >
              <Pencil data-icon="inline-start" />
              {t.editPlan}
            </Link>
          ) : (
            <p className="text-tertiary flex items-center gap-1.5 text-xs">
              <Lock aria-hidden="true" className="size-3.5" />
              {t.planLocked}
            </p>
          )}
        </Card>

        <Card title={t.sectionCrew}>
          <p className="text-sm">
            {mission.crew.length ? format(t.crewCount, { n: mission.crew.length }) : t.crewNone}
          </p>
          <form action={openMissionAt.bind(null, code, '/crew')}>
            <Button type="submit" variant="outline" size="sm">
              <Users data-icon="inline-start" />
              {status === 'finished' ? t.viewCrew : t.manageCrew}
            </Button>
          </form>
        </Card>
      </div>
    </>
  );
}

export function MissionView({ params }: { params: Promise<{ code: string }> }) {
  return (
    <PageContainer>
      <Suspense fallback={<MissionSkeleton />}>
        <MissionContent params={params} />
      </Suspense>
    </PageContainer>
  );
}

async function MissionPlanContent({ params }: { params: Promise<{ code: string }> }) {
  await connection();
  const [{ code: raw }, { lang, t }] = await Promise.all([params, getTexts(texts)]);
  const code = decodeURIComponent(raw).toUpperCase();
  const mission = await getMission(code);
  if (!mission) return <NotFound code={code} t={t} />;
  const status = mission.status ?? 'active';
  const back = `/missions/${code}`;
  if (!isPreparing(status)) {
    return (
      <EmptyState
        icon={<Lock />}
        title={t.planLocked}
        action={
          <Link href={back} className={buttonVariants({ variant: 'outline' })}>
            {t.openMissionPage}
          </Link>
        }
      />
    );
  }
  const { environments, templates } = planOptions(lang);
  const startMode: StartMode = status === 'scheduled' ? 'date' : 'manual';
  return (
    <>
      <header className="flex max-w-2xl flex-col gap-1">
        <h1 className="text-xl font-semibold tracking-[-0.01em]">
          {format(t.missionPlanTitle, { name: mission.name })}
        </h1>
        <p className="text-muted-foreground text-sm">{t.planIntro}</p>
      </header>
      <MissionBuilder
        lang={lang}
        environments={environments}
        templates={templates}
        today={new Date().toISOString().slice(0, 10)}
        submit={saveMissionPlanAction.bind(null, code)}
        initial={{
          name: mission.name,
          phases: mission.phases ?? [],
          startMode,
          start: mission.start.slice(0, 10),
        }}
        cancelHref={back}
      />
    </>
  );
}

export function MissionPlanView({ params }: { params: Promise<{ code: string }> }) {
  return (
    <PageContainer>
      <Suspense fallback={<MissionSkeleton />}>
        <MissionPlanContent params={params} />
      </Suspense>
    </PageContainer>
  );
}
