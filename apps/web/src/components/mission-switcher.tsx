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

  const choose = (code: string) =>
    startTransition(async () => {
      await setMission(code);
      router.push('/');
      router.refresh();
    });

  return (
    <SidebarMenu>
      <SidebarMenuItem>
        <DropdownMenu>
          <DropdownMenuTrigger
            render={
              <SidebarMenuButton
                size="lg"
                aria-busy={pending}
                className="hit-area text-foreground data-open:bg-sidebar-accent h-9 gap-2 px-1.5"
              />
            }
          >
            <span className="grid size-5 shrink-0 place-items-center">
              <Image src="/brand/haven-mark.svg" alt="" width={20} height={20} />
            </span>
            <span className="flex min-w-0 flex-1 items-baseline gap-1.5 text-left">
              <span className="truncate text-sm font-semibold">
                {current.name && current.name !== current.code ? current.name : 'HAVEN'}
              </span>
              <span className="sr-only">
                {' '}
                · HAVEN {t.app} · {t.sidebarMission}
              </span>
            </span>
            <ChevronsUpDown aria-hidden="true" className="text-tertiary ml-auto size-3.5!" />
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
