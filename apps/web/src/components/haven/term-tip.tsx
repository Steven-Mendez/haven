import type { ReactNode } from 'react';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';

/** A glossary entry resolved to one language (`explainTerm` from @haven/core). */
export type TermExplanation = { term: string; short: string; unitHint?: string };

type TipProps = {
  explanation: TermExplanation | undefined;
  children: ReactNode;
  /**
   * Inside a link or button: hover-only, no extra tab stop (nested interactive elements are invalid). The
   * explanation is not the only carrier of essential information.
   */
  nested?: boolean;
  /** Hide the dotted underline (e.g. on headings already styled as labels). */
  plain?: boolean;
  side?: 'top' | 'bottom' | 'left' | 'right';
  className?: string;
};

/**
 * Plain-language explanation of a medical or mission term, in place and without clutter: a dotted underline
 * opens a tooltip on hover or keyboard focus with the plain term (13/600), one sentence (12, secondary) and
 * the unit hint. Presentational (takes an already-resolved explanation), so client components can use it
 * without bundling the config. Renders the children untouched when there is no glossary entry.
 */
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
