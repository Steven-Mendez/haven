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
  header: ReactNode;
  children: ReactNode;
  footer: ReactNode;
};

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
      <SidebarRail aria-label="Panel" title="Panel" />
    </Sidebar>
  );
}

export function MissionSwitcherSkeleton() {
  return (
    <div className="flex flex-col gap-2">
      <div className="flex h-8 items-center justify-center px-1.5 group-data-[collapsible=icon]:hidden">
        <Image
          src="/brand/haven-mark.svg"
          alt="HAVEN"
          width={115}
          height={12}
          className="h-3 w-auto shrink-0 invert dark:invert-0"
        />
      </div>
      <div className="bg-card flex h-10 items-center gap-2.5 rounded-xl border px-2.5 group-data-[collapsible=icon]:hidden">
        <Skeleton className="size-5 animate-none rounded-full" />
        <Skeleton className="h-2.5 w-24 animate-none" />
      </div>
    </div>
  );
}

export function NavOperatorSkeleton() {
  return (
    <div className="flex flex-col gap-2 px-2 group-data-[collapsible=icon]:hidden">
      <div className="flex items-center gap-2">
        <Skeleton className="size-6 animate-none rounded-full" />
        <Skeleton className="h-2.5 w-24 animate-none" />
      </div>
    </div>
  );
}
