import { Check } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { format, type Language } from '@/lib/i18n';
import { ActivityRings } from './activity-rings';
import { havenTexts } from './texts';
import type { ZoneProgress } from './types';

type Props = {
  /** The crew member's `dailyProgress`: one entry per zone, 0..1. `null`: never arrived (empty ring). */
  segments: ZoneProgress[] | null;
  lang: Language;
  /** Display name per zone id (from config, already translated) for each segment's tooltip. */
  zoneNames?: Record<string, string>;
  /** Diameter in px. */
  size?: number;
  /** Shows «n/7» in the centre. */
  showCount?: boolean;
  /** @deprecated Ignored: the ring is always monochrome (DESIGN_SYSTEM.md §3.4, no zone colours). */
  colorBy?: 'mono' | 'zones';
  className?: string;
};

const DEFAULT_TOTAL = 7;

/**
 * Day ring: the routine sector of the mission disc (ring-1) for one crew member, with «n/7» in the
 * centre from 64 px. Only fully done actions count (closed decision 1: partials are not averaged) and it does
 * not measure health. The per-zone breakdown is in the tooltip. For all three rings use `ActivityRings`.
 */
export function DayRing({
  segments,
  lang,
  zoneNames,
  size = 72,
  showCount = true,
  className,
}: Props) {
  const t = havenTexts[lang];
  const list = segments ?? [];
  const total = list.length || DEFAULT_TOTAL;
  const done = list.filter((s) => s.progress >= 1).length;
  const summary = format(t.ringSummary, { n: done, total });

  const ring = (
    <ActivityRings
      rings={[{ id: 'routine', value: done, total }]}
      size={size}
      label={`${summary}. ${t.ringNote}`}
      center={showCount && size >= 64 ? `${done}/${total}` : undefined}
      className={className}
    />
  );

  if (!list.length) return ring;

  // Per-zone breakdown on hover/focus (shadcn Tooltip).
  return (
    <Tooltip>
      <TooltipTrigger render={<span className="rounded-full" />}>{ring}</TooltipTrigger>
      <TooltipContent side="left" className="flex-col items-start gap-1 py-2">
        <span className="font-semibold">{summary}</span>
        {list.map((s) => (
          <span key={s.zone} className="inline-flex items-center gap-1.5">
            <span
              aria-hidden="true"
              className="inline-block size-2 rounded-full"
              style={{ background: s.progress >= 1 ? 'var(--ring-1)' : 'var(--ring-1-track)' }}
            />
            {zoneNames?.[s.zone] ?? s.zone}
            {s.progress >= 1 ? (
              <Check aria-hidden="true" className="size-3" />
            ) : (
              ` ${Math.round(s.progress * 100)} %`
            )}
          </span>
        ))}
        <span className="opacity-70">{t.ringNote}</span>
      </TooltipContent>
    </Tooltip>
  );
}
