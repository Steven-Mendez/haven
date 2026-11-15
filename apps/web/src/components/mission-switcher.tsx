'use client';

import { Check, ChevronsUpDown, LogIn, Plus } from 'lucide-react';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { useTransition } from 'react';
import { setMission } from '@/components/haven/actions';
import { havenTexts } from '@/components/haven/texts';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { SidebarMenu, SidebarMenuButton, SidebarMenuItem } from '@/components/ui/sidebar';
import type { Language } from '@/lib/i18n';

export type MissionOption = {
  code: string;
  name: string;
  environment?: string;
};

type Props = {
  lang: Language;
  missions: MissionOption[];
  active: string | null;
};

export function MissionSwitcher({ lang, missions, active }: Props) {
  const t = havenTexts[lang];
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const current = missions.find((m) => m.code === active) ?? {
    code: active ?? '',
    name: active ?? t.noMission,
  };

  const label = current.name || current.code || 'HAVEN';

  const choose = (code: string) =>
    startTransition(async () => {
      await setMission(code);
      router.push('/');
      router.refresh();
    });

  return (
    <SidebarMenu className="gap-2">
      <li className="flex h-8 items-center justify-center px-1.5 group-data-[collapsible=icon]:hidden">
        <Image
          src="/brand/haven-mark.svg"
          alt="HAVEN"
          width={115}
          height={12}
          className="h-3 w-auto shrink-0 invert dark:invert-0"
        />
      </li>
      <SidebarMenuItem>
        <DropdownMenu>
          <DropdownMenuTrigger
            render={
              <SidebarMenuButton
                size="lg"
                aria-busy={pending}
                className="hit-area text-foreground bg-sidebar-hover border-sidebar-border hover:bg-sidebar-accent data-open:bg-sidebar-accent h-10 gap-2.5 rounded-xl border px-2.5 group-data-[collapsible=icon]:justify-center group-data-[collapsible=icon]:border-transparent group-data-[collapsible=icon]:bg-transparent"
              />
            }
          >
            <span
              aria-hidden="true"
              className="bg-sidebar-primary text-sidebar-primary-foreground text-2xs grid size-5 shrink-0 place-items-center rounded-full font-semibold uppercase"
            >
              {label.charAt(0)}
            </span>
            <span className="flex min-w-0 flex-1 items-baseline gap-1.5 text-left group-data-[collapsible=icon]:hidden">
              <span className="truncate text-sm font-medium">{label}</span>
              <span className="sr-only">
                {' '}
                · HAVEN {t.app} · {t.sidebarMission}
              </span>
            </span>
            <ChevronsUpDown
              aria-hidden="true"
              className="text-tertiary ml-auto size-3.5! group-data-[collapsible=icon]:hidden"
            />
          </DropdownMenuTrigger>
          <DropdownMenuContent className="min-w-60" align="start" side="bottom" sideOffset={4}>
            {missions.length ? (
              <>
                <DropdownMenuGroup>
                  <DropdownMenuLabel className="text-tertiary text-xs">
                    {t.sidebarMissions}
                  </DropdownMenuLabel>
                  {missions.map((m) => (
                    <DropdownMenuItem key={m.code} onClick={() => choose(m.code)} className="gap-2">
                      <span className="flex-1 truncate">
                        {m.name}
                        {m.environment ? (
                          <span className="text-muted-foreground"> · {m.environment}</span>
                        ) : null}
                      </span>
                      {m.code === active ? <Check aria-hidden="true" className="size-4" /> : null}
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuGroup>
                <DropdownMenuSeparator />
              </>
            ) : null}
            <DropdownMenuItem onClick={() => router.push('/missions/new')} className="gap-2">
              <Plus aria-hidden="true" className="text-muted-foreground size-4" />
              {t.createMission}
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => router.push('/missions#join-code')} className="gap-2">
              <LogIn aria-hidden="true" className="text-muted-foreground size-4" />
              {t.joinMission}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </SidebarMenuItem>
    </SidebarMenu>
  );
}
