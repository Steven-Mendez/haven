import { Clock } from 'lucide-react';
import type { ReactNode } from 'react';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import {
  format,
  formatDateTime,
  formatDelay,
  formatDuration,
  type Language,
  minutesBetween,
} from '@/lib/i18n';
import { cn } from '@/lib/utils';
import { lastDataText } from './levels';
import { havenTexts } from './texts';
import type { Now } from './types';

/** Default "no recent data" threshold when the API does not say (minutes). Same as NO_RECENT_DATA_HOURS. */
export const NO_RECENT_DATA_MIN = 6 * 60;

type Props = {
  /** ISO time of the last visible data; null when nothing has arrived yet. */
  lastDataAt: string | null;
  now: Now;
  lang: Language;
  /** Computed by the API (`CrewCard.noRecentData`). When missing, `thresholdMin` decides. */
  noRecentData?: boolean;
  thresholdMin?: number;
  className?: string;
};

/**
 * Relative time with a tooltip. Plain: the absolute UTC time. With `receivedAt` / `delayMin` / `staleHours`
 * it becomes the data-age tooltip: measured on board (crew time), received on Earth (UTC), one-way light time
 * and the «no recent data» rule, so every «ago» is interpretable.
 */
export function TimeAgo({
  at,
  lang,
  children,
  className,
  receivedAt,
  delayMin,
  staleHours,
}: {
  at: string;
  lang: Language;
  children: ReactNode;
  className?: string;
  /** When the packet reached Earth. */
  receivedAt?: string | null;
  /** One-way communication delay of the mission (minutes). */
  delayMin?: number;
  /** Hours without packets before «No recent data». */
  staleHours?: number;
}) {
  const t = havenTexts[lang];
  const rich = receivedAt !== undefined || delayMin !== undefined || staleHours !== undefined;
  return (
    <Tooltip>
      <TooltipTrigger
        render={<time dateTime={at} className={cn('cursor-default tabular-nums', className)} />}
      >
        {children}
      </TooltipTrigger>
      {rich ? (
        <TooltipContent className="flex-col items-start gap-1 px-2.5 py-2">
          <span className="grid grid-cols-[auto_auto] gap-x-3 gap-y-0.5">
            <span className="text-muted-foreground">{t.ageMeasured}</span>
            <span className="font-mono">{formatDateTime(at, lang)}</span>
            {receivedAt ? (
              <>
                <span className="text-muted-foreground">{t.ageReceived}</span>
                <span className="font-mono">{formatDateTime(receivedAt, lang)}</span>
              </>
            ) : null}
          </span>
          {delayMin !== undefined ? (
            <span className="text-muted-foreground">
              {format(t.ageLight, { t: formatDelay(delayMin) })}
            </span>
          ) : null}
          {staleHours !== undefined ? (
            <span className="text-tertiary text-2xs">
              {format(t.ageStaleRule, { h: staleHours })}
            </span>
          ) : null}
        </TooltipContent>
      ) : (
        <TooltipContent>{formatDateTime(at, lang)}</TooltipContent>
      )}
    </Tooltip>
  );
}

/**
 * «Last data 12 min ago» (caption, grey) or, when the data is old, «◷ No recent data · last received 7 h ago».
 * Never presents an old status as current.
 */
export function AgeLabel({
  lastDataAt,
  now,
  lang,
  noRecentData,
  thresholdMin = NO_RECENT_DATA_MIN,
  className,
}: Props) {
  const t = havenTexts[lang];

  if (!lastDataAt) {
    return (
      <span
        className={cn('text-muted-foreground inline-flex items-center gap-1.5 text-xs', className)}
      >
        <Clock aria-hidden="true" className="size-3.5" />
        {t.noDataYet}
      </span>
    );
  }

  const minutes = minutesBetween(lastDataAt, now);
  const stale = noRecentData ?? minutes >= thresholdMin;

  // Stale (DESIGN_SYSTEM.md §3.11): clock icon and primary text, never a colour.
  if (stale) {
    return (
      <span className={cn('inline-flex flex-wrap items-center gap-x-1.5 text-xs', className)}>
        <Clock aria-hidden="true" className="text-foreground size-3.5" />
        <span className="text-foreground font-medium">{t.noData}</span>
        <span className="text-muted-foreground">
          ·{' '}
          <TimeAgo at={lastDataAt} lang={lang}>
            {format(t.lastReceived, { t: formatDuration(minutes) })}
          </TimeAgo>
        </span>
      </span>
    );
  }

  return (
    <span className={cn('text-muted-foreground inline-flex items-center text-xs', className)}>
      <TimeAgo at={lastDataAt} lang={lang}>
        {lastDataText(lastDataAt, now, lang)}
      </TimeAgo>
    </span>
  );
}
