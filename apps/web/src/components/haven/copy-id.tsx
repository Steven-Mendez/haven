'use client';

import { Copy } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import type { Language } from '@/lib/i18n';
import { cn } from '@/lib/utils';
import { havenTexts } from './texts';

export async function copyText(value: string, lang: Language) {
  try {
    await navigator.clipboard.writeText(value);
    toast.success(havenTexts[lang].copied, { description: value });
  } catch {}
}

export function CopyId({
  value,
  display,
  lang,
  className,
}: {
  value: string;
  display?: string;
  lang: Language;
  className?: string;
}) {
  const t = havenTexts[lang];
  return (
    <Tooltip>
      <TooltipTrigger
        render={
          <Button
            variant="ghost"
            size="xs"
            onClick={() => copyText(value, lang)}
            aria-label={`${t.copyId}: ${value}`}
            className={cn(
              'hover:bg-hover hover:text-foreground group/copy h-auto gap-1 rounded-sm border-0 px-0.5 font-mono font-normal text-[length:inherit] text-inherit transition-colors select-text',
              className,
            )}
          />
        }
      >
        {display ?? value}
        <Copy
          aria-hidden="true"
          className="size-3 opacity-0 transition-opacity group-hover/copy:opacity-100 group-focus-visible/copy:opacity-100"
        />
      </TooltipTrigger>
      <TooltipContent className="flex-col items-start gap-0.5">
        <span className="font-mono">{value}</span>
        <span className="text-muted-foreground">{t.copyId}</span>
      </TooltipContent>
    </Tooltip>
  );
}
