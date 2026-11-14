import type { ReactElement, ReactNode } from 'react';
import { Kbd } from '@/components/ui/kbd';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';

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
