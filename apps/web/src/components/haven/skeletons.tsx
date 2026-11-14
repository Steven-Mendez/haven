import type { ComponentProps } from 'react';
import { Skeleton as UiSkeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';

// Loading placeholders with the same footprint as the real components (SPEC §6, Square skeleton): 8–10 px
// bars, radius 4, real hairlines where the content has them. Never fake levels. Static: no pulse.

export function Bar({ className, ...props }: ComponentProps<typeof UiSkeleton>) {
  return <UiSkeleton className={cn('h-2.5 animate-none rounded-sm', className)} {...props} />;
}

export function MissionHeaderSkeleton({ className }: { className?: string }) {
  return (
    <div className={cn('flex flex-col gap-2.5 py-1', className)}>
      <Bar className="h-4 w-36" />
      <Bar className="w-72 max-w-full" />
    </div>
  );
}

/** KPI strip placeholder: four tiles in one hairline box. */
export function StatStripSkeleton({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        'bg-border grid grid-cols-2 gap-px overflow-hidden rounded-xl border sm:grid-cols-4',
        className,
      )}
    >
      {Array.from({ length: 4 }, (_, i) => (
        // biome-ignore lint/suspicious/noArrayIndexKey: static placeholders
        <div key={i} className="bg-background md:bg-surface flex flex-col gap-3 px-4 py-3.5">
          <Bar className="w-24" />
          <Bar className="h-5 w-10" />
        </div>
      ))}
    </div>
  );
}

/** Grouped list placeholder: column header, one group header and `rows` 36 px rows. */
export function ListSkeleton({ rows = 3, className }: { rows?: number; className?: string }) {
  return (
    <div className={cn('overflow-hidden rounded-xl border', className)}>
      <div className="flex h-8 items-center border-b px-4">
        <Bar className="h-2 w-20" />
      </div>
      <div className="bg-card flex h-8 items-center gap-2 border-b px-4">
        <Bar className="size-2.5 rounded-full" />
        <Bar className="h-2 w-16" />
      </div>
      {Array.from({ length: rows }, (_, i) => (
        <div
          // biome-ignore lint/suspicious/noArrayIndexKey: static placeholders
          key={i}
          className="border-border-subtle flex h-9 items-center gap-3 border-b px-4 last:border-b-0"
        >
          <Bar className="size-2.5 rounded-full" />
          <Bar className="w-32" />
          <span className="flex-1" />
          <Bar className="hidden w-16 md:block" />
          <Bar className="w-10" />
        </div>
      ))}
    </div>
  );
}

export function MetricCardSkeleton({ className }: { className?: string }) {
  return (
    <div className={cn('flex h-24 flex-col gap-3 rounded-xl border p-4', className)}>
      <Bar className="w-20" />
      <Bar className="h-6 w-16" />
    </div>
  );
}

export function AstronautCardSkeleton({ className }: { className?: string }) {
  return (
    <div className={cn('flex flex-col gap-4 rounded-xl border p-4', className)}>
      <div className="flex items-center gap-3">
        <Bar className="size-10 rounded-lg" />
        <div className="flex flex-1 flex-col gap-2">
          <Bar className="w-32" />
          <Bar className="w-24" />
        </div>
      </div>
      <div className="flex flex-col gap-3">
        {Array.from({ length: 5 }, (_, i) => (
          // biome-ignore lint/suspicious/noArrayIndexKey: static placeholders
          <Bar key={i} className="w-full" />
        ))}
      </div>
    </div>
  );
}

/** Whole Crew page placeholder: title line, KPI strip and the grouped list. */
export function CrewPageSkeleton() {
  return (
    <div className="flex flex-col gap-6" aria-busy="true">
      <MissionHeaderSkeleton />
      <StatStripSkeleton />
      <ListSkeleton rows={3} />
    </div>
  );
}
