import { ChevronRight } from 'lucide-react';
import type { ReactNode } from 'react';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { cn } from '@/lib/utils';
import { LevelGlyph } from './level-glyph';
import type { VisualLevel } from './types';

type Props = {
  /** Visible summary, already translated: «24 en rango», «Corazón · ◆ 3 · ● 2». */
  title: ReactNode;
  /** Optional level symbol before the title (e.g. green for «24 in range»). */
  level?: VisualLevel;
  /** Optional right-aligned text («Ver todas (12)»). */
  meta?: ReactNode;
  /** The folded rows (usually ExpandableRow). */
  children: ReactNode;
  defaultOpen?: boolean;
  className?: string;
};

/**
 * A folded group (DESIGN_SYSTEM.md §8.0.4): «24 in range ›» that opens in line (shadcn `Collapsible`).
 * Use it for what is in range, for long lists («See all (n)») and for body zones with their counts.
 */
export function CollapsedGroup({ title, level, meta, children, defaultOpen, className }: Props) {
  return (
    <Collapsible defaultOpen={defaultOpen} className={cn('w-full', className)}>
      <CollapsibleTrigger className="group/group hover:bg-hover focus-visible:ring-ring flex min-h-9 w-full cursor-pointer items-center gap-2 rounded-md px-3 py-2 text-left text-sm focus-visible:ring-2 focus-visible:outline-none">
        {level ? <LevelGlyph level={level} size={10} /> : null}
        <span className="min-w-0 flex-1 truncate font-medium">{title}</span>
        {meta ? <span className="text-muted-foreground shrink-0 text-xs">{meta}</span> : null}
        <ChevronRight
          aria-hidden="true"
          className="text-muted-foreground size-4 shrink-0 transition-transform group-data-[panel-open]/group:rotate-90"
        />
      </CollapsibleTrigger>
      <CollapsibleContent className="flex flex-col pl-3">{children}</CollapsibleContent>
    </Collapsible>
  );
}
