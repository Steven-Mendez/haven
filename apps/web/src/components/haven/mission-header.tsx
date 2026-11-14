import { WifiOff } from 'lucide-react';
import type { ReactNode } from 'react';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import {
  format,
  formatDate,
  formatDuration,
  type Language,
  minutesBetween,
  translate,
} from '@/lib/i18n';
import { cn } from '@/lib/utils';
import { TimeAgo } from './age-label';
import { havenTexts } from './texts';
import type { MissionInfo, Now } from './types';

type Props = {
  /** `CrewResponse.mission` / `AstronautResponse.mission`. */
  mission: MissionInfo;
  now: Now;
  lang: Language;
  /** Environment display name (config `Environment.name`, translated). Defaults to the id. */
  environmentName?: string;
  /** Right-hand slot (actions, filters). */
  actions?: ReactNode;
  className?: string;
};

/**
 * Page title (20/600) + one 12 px metadata line (SPEC §6, X right-rail metadata): «ARES01 · Day 142 · Transit ·
 * updated 2 min ago». The one-way delay lives in the app header, so every «ago» stays interpretable without
 * repeating it here. «No link» appears as a neutral chip only when the mission reports it.
 */
export function MissionHeader({ mission, now, lang, environmentName, actions, className }: Props) {
  const t = havenTexts[lang];
  return (
    <section
      aria-label={t.mission}
      className={cn('flex flex-wrap items-end justify-between gap-4', className)}
    >
      <div className="flex min-w-0 flex-col gap-1">
        <h1 className="text-xl font-semibold tracking-[-0.01em]">{mission.name || mission.code}</h1>
        <p className="text-muted-foreground flex flex-wrap items-center gap-x-1.5 gap-y-1 text-xs">
          <span className="tabular-nums">
            {mission.status === 'finished'
              ? t.missionFinished
              : mission.status === 'planned'
                ? t.missionNotStarted
                : mission.status === 'scheduled'
                  ? format(t.missionStartsOn, { date: formatDate(mission.start, lang) })
                  : format(t.dayChip, { n: mission.day })}
          </span>
          <span aria-hidden="true" className="text-tertiary">
            ·
          </span>
          {mission.phase ? (
            // Phased mission: today's stretch by name, with its place in the plan («Phase 3 of 8»).
            <Tooltip>
              <TooltipTrigger render={<span className="cursor-default" />}>
                {mission.phase.label
                  ? translate(mission.phase.label, lang)
                  : (environmentName ?? mission.environment)}
                <span className="text-tertiary">
                  {' '}
                  ·{' '}
                  {format(t.phaseOf, {
                    n: mission.phase.index + 1,
                    total: mission.phase.total,
                  })}
                </span>
              </TooltipTrigger>
              <TooltipContent>
                {environmentName ?? mission.environment} ·{' '}
                {format(t.phaseDaysRange, { a: mission.phase.startDay, b: mission.phase.endDay })}
              </TooltipContent>
            </Tooltip>
          ) : (
            <span>{environmentName ?? mission.environment}</span>
          )}
          {mission.lastDataAt ? (
            <>
              <span aria-hidden="true" className="text-tertiary">
                ·
              </span>
              <TimeAgo at={mission.lastDataAt} lang={lang}>
                {format(t.updated, {
                  t: formatDuration(minutesBetween(mission.lastDataAt, now)),
                })}
              </TimeAgo>
            </>
          ) : null}
          {mission.linkDown ? (
            <span className="text-foreground ml-1 inline-flex h-5 items-center gap-1 rounded-md border px-1.5">
              <WifiOff aria-hidden="true" className="size-3" />
              {t.linkDownChip}
            </span>
          ) : null}
        </p>
      </div>
      {actions ? <div className="flex items-center gap-2">{actions}</div> : null}
    </section>
  );
}
