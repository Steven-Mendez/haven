import type { ReactNode } from 'react';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';

export type TermExplanation = { term: string; short: string; unitHint?: string };

type TipProps = {
  explanation: TermExplanation | undefined;
  children: ReactNode;
  nested?: boolean;
  plain?: boolean;
  side?: 'top' | 'bottom' | 'left' | 'right';
  className?: string;
};

export function TermTip({
  explanation,
  children,
  nested,
  plain,
  side = 'top',
  className,
}: TipProps) {
  if (!explanation) return <>{children}</>;
  return (
    <Tooltip>
      <TooltipTrigger
        render={
          <span
            tabIndex={nested ? undefined : 0}
            className={cn(
              'cursor-help rounded-sm',
              !plain &&
                'decoration-tertiary underline decoration-dotted decoration-1 underline-offset-4',
              className,
            )}
          />
        }
      >
        {children}
      </TooltipTrigger>
      <TooltipContent side={side} className="max-w-64 flex-col items-start gap-0.5 px-2.5 py-2">
        <span className="text-sm font-semibold">{explanation.term}</span>
        <span className="text-muted-foreground text-xs">{explanation.short}</span>
        {explanation.unitHint ? (
          <span className="text-tertiary text-2xs">{explanation.unitHint}</span>
        ) : null}
      </TooltipContent>
    </Tooltip>
  );
}
