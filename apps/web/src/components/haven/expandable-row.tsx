import { ChevronDown, ChevronRight } from 'lucide-react';
import Link from 'next/link';
import type { ReactNode } from 'react';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Item, ItemActions, ItemContent, ItemMedia, ItemTitle } from '@/components/ui/item';
import { cn } from '@/lib/utils';

type Props = {
  title: ReactNode;
  leading?: ReactNode;
  value?: ReactNode;
  meta?: ReactNode;
  children?: ReactNode;
  href?: string;
  defaultOpen?: boolean;
  ariaLabel?: string;
  className?: string;
};

const ROW = 'min-h-9 w-full gap-3 rounded-md px-3 py-1.5 text-left hover:bg-hover';

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
