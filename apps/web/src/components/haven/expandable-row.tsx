import { ChevronDown, ChevronRight } from 'lucide-react';
import Link from 'next/link';
import type { ReactNode } from 'react';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Item, ItemActions, ItemContent, ItemMedia, ItemTitle } from '@/components/ui/item';
import { cn } from '@/lib/utils';

type Props = {
  /** Main text («Heart rate», «Mateo Ríos»). One line, truncated. */
  title: ReactNode;
  /** Leading slot: a LevelBadge (symbolOnly), a portrait or an icon. */
  leading?: ReactNode;
  /** Value shown right after the title («168 bpm», «4 alerts»). Tabular figures. */
  value?: ReactNode;
  /** Right-aligned secondary text before the chevron («53 min ago»). */
  meta?: ReactNode;
  /**
   * Detail revealed in line when the row is expanded (engine explanation, actions, usual range…).
   * Omit it and pass `href` for a navigation row instead.
   */
  children?: ReactNode;
  /** Navigation row: the whole row links here and shows ›. Ignored when `children` is set. */
  href?: string;
  defaultOpen?: boolean;
  /** Full accessible name when the visible line is abbreviated (source, age…). */
  ariaLabel?: string;
  className?: string;
};

const ROW = 'min-h-9 w-full gap-3 rounded-md px-3 py-1.5 text-left hover:bg-hover';

/**
 * One-line list row with progressive disclosure (DESIGN_SYSTEM.md §8.0.3–4): leading symbol · title ·
 * value · meta · chevron. The detail opens in line under the row (shadcn `Collapsible` + `Item`), or the
 * row navigates to `href`. Collapsed content stays in the DOM order for screen readers once opened.
 */
export function ExpandableRow({
  title,
  leading,
  value,
  meta,
  children,
  href,
  defaultOpen,
  ariaLabel,
  className,
}: Props) {
  const line = (chevron: ReactNode) => (
    <>
      {leading ? <ItemMedia className="shrink-0">{leading}</ItemMedia> : null}
      <ItemContent className="min-w-0 flex-row items-baseline gap-2">
        <ItemTitle className="min-w-0 truncate font-medium">{title}</ItemTitle>
        {value !== undefined && value !== null ? (
          <span className="numeric shrink-0 text-sm">{value}</span>
        ) : null}
      </ItemContent>
      {meta || chevron ? (
        <ItemActions className="text-muted-foreground shrink-0 text-xs">
          {meta}
          {chevron}
        </ItemActions>
      ) : null}
    </>
  );

  if (!children) {
    if (href) {
      return (
        <Item
          size="sm"
          aria-label={ariaLabel}
          className={cn(ROW, 'flex-nowrap', className)}
          render={<Link href={href} />}
        >
          {line(<ChevronRight aria-hidden="true" className="size-4" />)}
        </Item>
      );
    }
    return (
      <Item
        size="sm"
        aria-label={ariaLabel}
        className={cn(ROW, 'flex-nowrap hover:bg-transparent', className)}
      >
        {line(null)}
      </Item>
    );
  }

  // Expandable: a real <button> (spans inside, so the markup stays valid) + the detail panel.
  return (
    <Collapsible defaultOpen={defaultOpen} className={cn('w-full', className)}>
      <CollapsibleTrigger
        aria-label={ariaLabel}
        className={cn(
          ROW,
          'group/row focus-visible:ring-ring flex cursor-pointer items-center text-sm focus-visible:ring-2 focus-visible:outline-none',
        )}
      >
        {leading ? <span className="flex shrink-0 items-center">{leading}</span> : null}
        <span className="flex min-w-0 flex-1 items-baseline gap-2">
          <span className="min-w-0 truncate font-medium">{title}</span>
          {value !== undefined && value !== null ? (
            <span className="numeric shrink-0">{value}</span>
          ) : null}
        </span>
        <span className="text-muted-foreground flex shrink-0 items-center gap-2 text-xs">
          {meta}
          <ChevronDown
            aria-hidden="true"
            className="size-4 transition-transform group-data-[panel-open]/row:rotate-180"
          />
        </span>
      </CollapsibleTrigger>
      <CollapsibleContent className="text-muted-foreground px-3 pt-1 pb-3 text-[13px]">
        {children}
      </CollapsibleContent>
    </Collapsible>
  );
}
