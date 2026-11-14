import { LogIn, Plus, Rocket } from 'lucide-react';
import Link from 'next/link';
import { buttonVariants } from '@/components/ui/button';
import type { Language } from '@/lib/i18n';
import { cn } from '@/lib/utils';
import { havenTexts } from './texts';

/**
 * First run (no mission yet): what HAVEN does and the two ways in — create a mission or join one by code.
 * Shown by every page that needs an active mission instead of inventing one.
 */
export function FirstMission({ lang }: { lang: Language }) {
  const t = havenTexts[lang];
  return (
    <section className="mx-auto flex w-full max-w-md flex-1 flex-col items-center justify-center gap-4 py-16 text-center">
      <span className="bg-hover grid size-12 place-items-center rounded-full">
        <Rocket aria-hidden="true" className="text-muted-foreground size-5" />
      </span>
      <div className="flex flex-col gap-1.5">
        <h1 className="text-xl font-semibold tracking-[-0.01em]">{t.firstMissionTitle}</h1>
        <p className="text-muted-foreground text-sm leading-6">{t.firstMissionBody}</p>
      </div>
      <div className="flex flex-wrap justify-center gap-2">
        <Link href="/missions/new" className={buttonVariants()}>
          <Plus data-icon="inline-start" />
          {t.firstMissionCreate}
        </Link>
        <Link href="/missions#join-code" className={cn(buttonVariants({ variant: 'outline' }))}>
          <LogIn data-icon="inline-start" />
          {t.firstMissionJoin}
        </Link>
      </div>
    </section>
  );
}
