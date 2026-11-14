import type { ReactNode } from 'react';
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from '@/components/ui/empty';
import { cn } from '@/lib/utils';

type Props = {
  title: string;
  description?: ReactNode;
  icon?: ReactNode;
  /** A link or button that gets the user unstuck (e.g. «Create mission»). */
  action?: ReactNode;
  className?: string;
};

/**
 * Minimal empty state (SPEC §6 «Estados», Plane / Square): 20 px icon, one 13 px title line, one 12 px help line
 * and at most one action, inside a hairline box. Errors use it too, never in red (red is health).
 */
export function EmptyState({ title, description, icon, action, className }: Props) {
  // border-solid goes last: dashed is reserved for «pending», even if a caller passes it.
  return (
    <Empty className={cn('gap-4 rounded-xl border px-6 py-10', className, 'border-solid')}>
      <EmptyHeader className="gap-1.5">
        {icon ? (
          <EmptyMedia className="text-tertiary mb-1 [&_svg]:size-5" aria-hidden="true">
            {icon}
          </EmptyMedia>
        ) : null}
        <EmptyTitle className="text-sm font-medium">{title}</EmptyTitle>
        {description ? (
          <EmptyDescription className="text-xs">{description}</EmptyDescription>
        ) : null}
      </EmptyHeader>
      {action ? <EmptyContent>{action}</EmptyContent> : null}
    </Empty>
  );
}
