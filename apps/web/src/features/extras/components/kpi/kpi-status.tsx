import { CircleCheck, TriangleAlert } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { KpiTexts } from './texts';

/** In / out of the reference range: always icon + text, never color alone. */
export function RangeStatus({
  inside,
  t,
  className,
}: {
  inside: boolean;
  t: KpiTexts;
  className?: string;
}) {
  const Icon = inside ? CircleCheck : TriangleAlert;
  return (
    <span
      className={cn(
        'inline-flex shrink-0 items-center gap-1 text-xs',
        inside ? 'text-level-green' : 'text-level-amber',
        className,
      )}
    >
      <Icon aria-hidden="true" className="size-3.5" />
      {inside ? t.kpiInRange : t.kpiOutOfRange}
    </span>
  );
}

export function NoData({ t, className }: { t: KpiTexts; className?: string }) {
  return (
    <div
      className={cn(
        'text-muted-foreground grid h-full min-h-12 place-items-center text-xs',
        className,
      )}
    >
      {t.noGroupStat}
    </div>
  );
}
