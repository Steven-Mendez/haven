import { Check } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { format, type Language } from '@/lib/i18n';
import { ActivityRings } from './activity-rings';
import { havenTexts } from './texts';
import type { ZoneProgress } from './types';

type Props = {
  segments: ZoneProgress[] | null;
  lang: Language;
  zoneNames?: Record<string, string>;
  size?: number;
  showCount?: boolean;
  colorBy?: 'mono' | 'zones';
  className?: string;
};

const DEFAULT_TOTAL = 7;

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
