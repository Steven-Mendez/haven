'use client';

import { Copy, ExternalLink, SquareArrowOutUpRight } from 'lucide-react';
import { useRouter } from 'next/navigation';
import type { ReactNode } from 'react';
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuTrigger,
} from '@/components/ui/context-menu';
import type { Language } from '@/lib/i18n';
import { copyText } from './copy-id';
import { havenTexts } from './texts';

export function RowContextMenu({
  href,
  id,
  lang,
  children,
}: {
  href: string;
  id: string;
  lang: Language;
  children: ReactNode;
}) {
  const t = havenTexts[lang];
  const router = useRouter();
  return (
    <ContextMenu>
      <ContextMenuTrigger render={<div />}>{children}</ContextMenuTrigger>
      <ContextMenuContent className="min-w-52">
        <ContextMenuItem onClick={() => router.push(href)}>
          <SquareArrowOutUpRight aria-hidden="true" />
          {t.openRow}
        </ContextMenuItem>
        <ContextMenuItem onClick={() => window.open(href, '_blank', 'noopener')}>
          <ExternalLink aria-hidden="true" />
          {t.openNewTab}
        </ContextMenuItem>
        <ContextMenuSeparator />
        <ContextMenuItem onClick={() => copyText(id, lang)}>
          <Copy aria-hidden="true" />
          {t.copyId}
          <span className="text-tertiary text-2xs ml-auto max-w-28 truncate font-mono">{id}</span>
        </ContextMenuItem>
      </ContextMenuContent>
    </ContextMenu>
  );
}
