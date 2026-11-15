import { type ReentryReadiness, reentry } from '@haven/core';
import { Activity, Droplets, Info, type LucideIcon, PlaneLanding, Shirt } from 'lucide-react';
import { AgeLabel, EmptyState, Hint } from '@/components/haven';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { format, type Language } from '@/lib/i18n';
import { cn } from '@/lib/utils';
import type { StoredMission } from '@/server/types';
import type { ExtrasTexts } from '../i18n';
import { daysToReentry, type ReentryRow } from '../logic/reentry';
import { getReentryReadiness } from '../server';
import { CrewTable } from './crew-table';
import { CrewCell, crewHref, crewTableTexts, StatusPill, type Tone, toneOf } from './panel-parts';

const READINESS: ReentryReadiness[] = ['ready', 'in-progress', 'review', 'unfit', 'not-started'];

const READINESS_TONE: Record<ReentryReadiness, Tone> = {
  ready: 'green',
  'in-progress': 'muted',
  'not-started': 'muted',
  review: 'amber',
  unfit: 'red',
};

const ITEM_ICON: Record<string, LucideIcon> = {
  'fluid-loading': Droplets,
  'compression-garment': Shirt,
  'orthostatic-test': Activity,
};

const readinessLabel = (r: ReentryReadiness, t: ExtrasTexts) => t[`reentry-${r}`];

function phaseText(mission: StoredMission, t: ExtrasTexts) {
  const days = daysToReentry(mission.phases, mission.day);
  if (days === null) return t.reentryNoPlan;
  const end = (mission.durationDays ?? 0) > 0 && mission.day > (mission.durationDays ?? 0);
  if (end) return t.reentryPast;
  if (days <= 0) return t.reentryNow;
  if (days === 1) return t.reentryTomorrow;
  return format(t.reentryIn, { n: days, day: mission.day + days });
}

/** The three checklist items as one segmented strip: green when done. */
function Checklist({ row, lang }: { row: ReentryRow; lang: Language }) {
  return (
    <ul className="bg-surface-elevated/60 inline-flex items-center divide-x rounded-md border">
      {reentry.checklist.map((item) => {
        const done = Boolean(row.status.items.find((i) => i.id === item.id)?.doneAt);
        const Icon = ITEM_ICON[item.id] ?? Activity;
        const label = `${item.name[lang]}: ${done ? '✓' : '—'}`;
        return (
          <li key={item.id}>
            <Hint label={label} side="top">
              <span
                className={cn(
                  'flex size-7 items-center justify-center',
                  done ? 'text-level-green' : 'text-tertiary',
                )}
              >
                <Icon aria-hidden="true" className="size-3.5" />
                <span className="sr-only">{label}</span>
              </span>
            </Hint>
          </li>
        );
      })}
    </ul>
  );
}

export async function ReentryPanel({
  mission,
  lang,
  t,
}: {
  mission: StoredMission;
  lang: Language;
  t: ExtrasTexts;
}) {
  const data = await getReentryReadiness(mission.code);
  const rows = data?.rows ?? [];
  const ready = rows.filter((r) => r.status.readiness === 'ready').length;

  return (
    <div className="flex min-w-0 flex-col gap-3">
      {rows.length === 0 || !data ? (
        <EmptyState title={t.reentryEmpty} description={t.reentryEmptyDetail} />
      ) : (
        <CrewTable
          id="reentry"
          testId="reentry-table"
          title={t.reentryTitle}
          description={t.reentryDescription}
          aside={
            <span
              className="border-brand/30 bg-brand-subtle text-link inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs"
              data-testid="reentry-phase"
            >
              <PlaneLanding aria-hidden="true" className="size-3.5" />
              {phaseText(mission, t)}
            </span>
          }
          groups={READINESS.map((r) => ({
            key: r,
            tone: READINESS_TONE[r],
            label: readinessLabel(r, t),
          }))}
          columns={[
            { label: t.astronaut },
            { label: t.reentryStatus },
            { label: t.checklistCol },
            { label: t.orthostaticCol, className: 'whitespace-normal' },
            { label: t.hydrationCol, className: 'hidden xl:table-cell' },
            { label: t.bloodPressureCol, className: 'hidden xl:table-cell' },
          ]}
          rows={rows.map((row) => {
            const o = row.status.orthostatic;
            return {
              id: row.id,
              name: row.name,
              group: row.status.readiness,
              href: crewHref(row.id),
              cells: [
                <CrewCell
                  key="crew"
                  id={row.id}
                  name={row.name}
                  detail={
                    <AgeLabel
                      lastDataAt={row.lastDataAt}
                      now={data.generatedAt}
                      lang={lang}
                      noRecentData={row.noRecentData}
                    />
                  }
                />,
                <StatusPill key="status" tone={READINESS_TONE[row.status.readiness]}>
                  {readinessLabel(row.status.readiness, t)}
                </StatusPill>,
                <div key="checklist" className="flex items-center gap-2">
                  <Checklist row={row} lang={lang} />
                  <span className="text-tertiary tabular-nums">
                    {row.status.done}/{row.status.total}
                  </span>
                </div>,
                o ? (
                  <span key="orthostatic" className="flex flex-col items-start gap-1">
                    <StatusPill tone={toneOf(o.level)}>+{o.rise} lpm</StatusPill>
                    <span className="text-muted-foreground tabular-nums">
                      {Number.isFinite(o.supine) ? o.supine : '—'} →{' '}
                      {Number.isFinite(o.standing) ? o.standing : '—'} lpm
                      {o.symptoms.length ? ` · ${t.orthostaticSymptoms}` : ''}
                    </span>
                  </span>
                ) : (
                  <span key="orthostatic" className="text-tertiary">
                    {t.notDone}
                  </span>
                ),
                <StatusPill key="hydration" tone={toneOf(row.hydration)}>
                  {levelText(row.hydration, t)}
                </StatusPill>,
                <StatusPill key="pressure" tone={toneOf(row.bloodPressure)}>
                  {levelText(row.bloodPressure, t)}
                </StatusPill>,
              ],
            };
          })}
          summary={format(t.reentryFooter, { ready, total: rows.length })}
          texts={crewTableTexts(t)}
        />
      )}
      <Collapsible>
        <CollapsibleTrigger className="text-muted-foreground hover:text-foreground hit-area flex min-h-8 items-center gap-1.5 text-xs">
          <Info aria-hidden="true" className="size-3.5" />
          {t.howCalculated}
        </CollapsibleTrigger>
        <CollapsibleContent className="text-muted-foreground max-w-3xl pt-1 text-xs">
          {t.reentrySource}
        </CollapsibleContent>
      </Collapsible>
    </div>
  );
}

function levelText(level: string, t: ExtrasTexts) {
  return { green: t.scaleGreen, amber: t.scaleAmber, red: t.scaleRed }[level] ?? t.levelPending;
}
