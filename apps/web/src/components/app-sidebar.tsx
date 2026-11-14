import Image from 'next/image';
import type { ComponentProps, ReactNode } from 'react';
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarRail,
} from '@/components/ui/sidebar';
import { Skeleton } from '@/components/ui/skeleton';

type Props = Omit<ComponentProps<typeof Sidebar>, 'children'> & {
  /** Usually <MissionSwitcher>. */
  header: ReactNode;
  /** Usually <NavMain>. */
  children: ReactNode;
  /** Usually <NavOperator>. */
  footer: ReactNode;
};

/**
 * Ground View sidebar (shadcn sidebar, `inset` variant: 240 px on the page background with the content in an
 * inset bordered panel, SPEC §6 «Armazón web»). Collapses to icons on desktop and becomes a
 * Sheet on narrow screens (ui/sidebar). It takes slots instead of data so the root layout can stream
 * each slot in its own <Suspense> while the Sidebar frame itself renders synchronously: if the frame
 * suspended, it would hydrate after `useIsMobile` flipped and mismatch the server HTML on phones.
 */
export function AppSidebar({ header, children, footer, ...props }: Props) {
  return (
    <Sidebar collapsible="icon" variant="inset" {...props}>
      <SidebarHeader className="pt-[max(0.5rem,env(safe-area-inset-top))] pl-[max(0.5rem,env(safe-area-inset-left))]">
        {header}
      </SidebarHeader>
      <SidebarContent className="pl-[env(safe-area-inset-left)]">{children}</SidebarContent>
      <SidebarFooter className="pb-[max(0.5rem,env(safe-area-inset-bottom))] pl-[max(0.5rem,env(safe-area-inset-left))]">
        {footer}
      </SidebarFooter>
      {/* «Panel» reads the same in es and en: the frame renders outside the language Suspense. */}
      <SidebarRail aria-label="Panel" title="Panel" />
    </Sidebar>
  );
}

// Language-neutral fallbacks for the layout's <Suspense>: no text, so a reader in English never sees a
// Spanish flash while the cookie-dependent slots stream in. Static (no pulse, no Math.random).

/** Placeholder for MissionSwitcher: the brand mark and one bar. */
export function MissionSwitcherSkeleton() {
  return (
    <div className="flex h-9 items-center gap-2 px-1.5">
      <Image src="/brand/haven-mark.svg" alt="" width={20} height={20} className="shrink-0" />
      <Skeleton className="h-2.5 w-28 animate-none group-data-[collapsible=icon]:hidden" />
    </div>
  );
}

/** Placeholder for NavOperator: the operator row. */
export function NavOperatorSkeleton() {
  return (
    <div className="flex flex-col gap-2 px-2 group-data-[collapsible=icon]:hidden">
      <div className="flex items-center gap-2 border-t pt-2">
        <Skeleton className="size-6 animate-none rounded-full" />
        <Skeleton className="h-2.5 w-24 animate-none" />
      </div>
    </div>
  );
}
