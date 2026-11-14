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
  action?: ReactNode;
  className?: string;
};

export function EmptyState({ title, description, icon, action, className }: Props) {
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
