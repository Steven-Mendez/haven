import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

/** Page frame shared by every view: same width and gutters as the app header. Renders a <div>: the
 * landmark <main> is SidebarInset in the root layout, and nesting a second <main> breaks landmark navigation. */
export function PageContainer({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        'mx-auto flex w-full max-w-[1200px] flex-1 flex-col gap-6 px-4 py-5 sm:px-6 sm:py-6',
        className,
      )}
    >
      {children}
    </div>
  );
}

/** Titled section inside a page. */
export function Section({
  title,
  description,
  actions,
  children,
  className,
}: {
  title: ReactNode;
  description?: ReactNode;
  actions?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={cn('flex flex-col gap-3', className)}>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="flex flex-col gap-0.5">
          <h2 className="text-sm font-semibold">{title}</h2>
          {description ? <p className="text-muted-foreground text-xs">{description}</p> : null}
        </div>
        {actions}
      </div>
      {children}
    </section>
  );
}
