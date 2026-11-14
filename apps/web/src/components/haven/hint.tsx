import type { ReactElement, ReactNode } from 'react';
import { Kbd } from '@/components/ui/kbd';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';

/**
 * Tooltip for an icon-only control (Linear/X): label + optional shortcut chip on the right («Search ⌘K»).
 * The child must be one element that keeps its own accessible name (aria-label or sr-only text).
 */
export function Hint({
  label,
  kbd,
  side = 'bottom',
  children,
}: {
  label: ReactNode;
  kbd?: string;
  side?: 'top' | 'bottom' | 'left' | 'right';
  children: ReactElement;
}) {
  return (
    <Tooltip>
      <TooltipTrigger render={children} />
      <TooltipContent side={side}>
        <span>{label}</span>
        {kbd ? <Kbd className="border-0">{kbd}</Kbd> : null}
      </TooltipContent>
    </Tooltip>
  );
}
