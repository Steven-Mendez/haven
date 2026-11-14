'use client';

import { Keyboard, Settings, UserRound } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { Portrait } from '@/components/haven/portrait';
import { havenTexts } from '@/components/haven/texts';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuShortcut,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import type { Language } from '@/lib/i18n';

export function OperatorMenu({ lang }: { lang: Language }) {
  const t = havenTexts[lang];
  const router = useRouter();
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        aria-label={`${t.operatorMenu}: ${t.operatorName}`}
        className="hover:bg-hover data-popup-open:bg-active hit-area focus-visible:ring-ring flex h-8 min-w-0 flex-1 items-center gap-2 rounded-md px-1.5 text-left outline-none group-data-[collapsible=icon]:hidden focus-visible:ring-2"
      >
        <Portrait id="lucia-control" name={t.operatorName} size={24} />
        <span className="grid min-w-0 flex-1 leading-tight">
          <span className="truncate text-xs font-medium">{t.operatorName}</span>
          <span className="text-tertiary text-2xs truncate">{t.operatorRole}</span>
        </span>
      </DropdownMenuTrigger>
      <DropdownMenuContent className="min-w-56" align="start" side="top" sideOffset={6}>
        <DropdownMenuGroup>
          <DropdownMenuLabel className="text-tertiary text-xs">{t.operatorRole}</DropdownMenuLabel>
          <DropdownMenuItem onClick={() => router.push('/settings#profile')} className="gap-2">
            <UserRound aria-hidden="true" className="text-muted-foreground" />
            {t.navProfile}
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => router.push('/settings')} className="gap-2">
            <Settings aria-hidden="true" className="text-muted-foreground" />
            {t.navSettings}
          </DropdownMenuItem>
        </DropdownMenuGroup>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={() => router.push('/settings#shortcuts')} className="gap-2">
          <Keyboard aria-hidden="true" className="text-muted-foreground" />
          {t.shortcutsTitle}
          <DropdownMenuShortcut>?</DropdownMenuShortcut>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
