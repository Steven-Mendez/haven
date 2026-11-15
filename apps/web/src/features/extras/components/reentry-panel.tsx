import { type Level, type ReentryReadiness, reentry } from '@haven/core';
import { Check, Info, Minus } from 'lucide-react';
import {
  AgeLabel,
  EmptyState,
  LevelBadge,
  LevelGlyph,
  levelLabel,
  Section,
} from '@/components/haven';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { format, type Language } from '@/lib/i18n';
import { cn } from '@/lib/utils';
import type { StoredMission } from '@/server/types';
import type { ExtrasTexts } from '../i18n';
import { daysToReentry, type ReentryRow } from '../logic/reentry';
import { getReentryReadiness } from '../server';

const READINESS: ReentryReadiness[] = ['ready', 'in-progress', 'review', 'unfit', 'not-started'];

const READINESS_LEVEL: Record<ReentryReadiness, Level> = {
  ready: 'green',
  'in-progress': 'pending',
  'not-started': 'pending',
  review: 'amber',
  unfit: 'red',
};

function readinessLabel(r: ReentryReadiness, t: ExtrasTexts) {
  return t[`reentry-${r}`];
}

function phaseText(mission: StoredMission, t: ExtrasTexts) {
  const days = daysToReentry(mission.phases, mission.day);
  if (days === null) return t.reentryNoPlan;
  const end = (mission.durationDays ?? 0) > 0 && mission.day > (mission.durationDays ?? 0);
  if (end) return t.reentryPast;
  if (days <= 0) return t.reentryNow;
  if (days === 1) return t.reentryTomorrow;
  return format(t.reentryIn, { n: days, day: mission.day + days });
}

function LevelCell({ level, lang, muted }: { level: Level; lang: Language; muted: boolean }) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 text-xs',
        muted || level === 'pending' ? 'text-muted-foreground' : 'text-foreground',
      )}
    >
      <LevelGlyph level={level} size={10} muted={muted} />
      {levelLabel(level, lang)}
    </span>
  );
}

function Checklist({ row, lang }: { row: ReentryRow; lang: Language }) {
  return (
    <ul className="flex flex-col gap-0.5 text-xs">
      {reentry.checklist.map((item) => {
        const done = Boolean(row.status.items.find((i) => i.id === item.id)?.doneAt);
        return (
          <li
            key={item.id}
            className={cn(
              'flex items-center gap-1.5',
              done ? 'text-foreground' : 'text-muted-foreground',
            )}
          >
            {done ? (
              <Check aria-hidden="true" className="text-brand size-3.5" />
            ) : (
              <Minus aria-hidden="true" className="size-3.5" />
            )}
            {item.name[lang]}
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
  const counts = Object.fromEntries(
    READINESS.map((r) => [r, rows.filter((x) => x.status.readiness === r).length]),
  ) as Record<ReentryReadiness, number>;

  return (
    <Section title={t.reentryTitle} description={t.reentryDescription}>
      <p className="text-sm" data-testid="reentry-phase">
        {phaseText(mission, t)}
      </p>
      {rows.length === 0 || !data ? (
        <EmptyState title={t.reentryEmpty} description={t.reentryEmptyDetail} />
      ) : (
        <>
          <dl
            className="bg-border grid grid-cols-2 gap-px overflow-hidden rounded-xl border sm:grid-cols-5"
            aria-label={t.reentryStatus}
          >
            {READINESS.map((r) => (
              <div key={r} className="bg-background md:bg-surface flex flex-col gap-1.5 px-4 py-3">
                <dt className="text-muted-foreground flex items-center gap-1.5 text-xs">
                  <LevelGlyph level={READINESS_LEVEL[r]} size={10} />
                  {readinessLabel(r, t)}
                </dt>
                <dd className="text-[28px] leading-8 font-medium tracking-[-0.02em] tabular-nums">
                  {counts[r]}
                  <span className="text-tertiary ml-1 text-sm font-normal">/ {rows.length}</span>
                </dd>
              </div>
            ))}
          </dl>
          <div className="overflow-hidden rounded-xl border">
            <Table data-testid="reentry-table">
              <TableHeader>
                <TableRow>
                  <TableHead className="pl-4">{t.astronaut}</TableHead>
                  <TableHead>{t.reentryStatus}</TableHead>
                  <TableHead>{t.checklistCol}</TableHead>
                  <TableHead>{t.orthostaticCol}</TableHead>
                  <TableHead>{t.hydrationCol}</TableHead>
                  <TableHead>{t.bloodPressureCol}</TableHead>
                  <TableHead className="pr-4">{t.lastData}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((row) => {
                  const o = row.status.orthostatic;
                  return (
                    <TableRow key={row.id}>
                      <TableCell className="pl-4 font-medium">{row.name}</TableCell>
                      <TableCell>
                        <LevelBadge
                          level={row.status.level}
                          lang={lang}
                          label={readinessLabel(row.status.readiness, t)}
                        />
                      </TableCell>
                      <TableCell>
                        <Checklist row={row} lang={lang} />
                      </TableCell>
                      <TableCell className="text-xs whitespace-normal">
                        {o ? (
                          <span className="flex flex-col gap-0.5">
                            <LevelCell level={o.level} lang={lang} muted={row.noRecentData} />
                            <span className="text-muted-foreground tabular-nums">
                              {format(t.orthostaticValue, {
                                rise: o.rise,
                                supine: Number.isFinite(o.supine) ? o.supine : '—',
                                standing: Number.isFinite(o.standing) ? o.standing : '—',
                              })}
                              {o.symptoms.length ? ` · ${t.orthostaticSymptoms}` : ''}
                            </span>
                          </span>
                        ) : (
                          <span className="text-muted-foreground">{t.notDone}</span>
                        )}
                      </TableCell>
                      <TableCell>
                        <LevelCell level={row.hydration} lang={lang} muted={row.noRecentData} />
                      </TableCell>
                      <TableCell>
                        <LevelCell level={row.bloodPressure} lang={lang} muted={row.noRecentData} />
                      </TableCell>
                      <TableCell className="pr-4">
                        <AgeLabel
                          lastDataAt={row.lastDataAt}
                          now={data.generatedAt}
                          lang={lang}
                          noRecentData={row.noRecentData}
                        />
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        </>
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
    </Section>
  );
}
