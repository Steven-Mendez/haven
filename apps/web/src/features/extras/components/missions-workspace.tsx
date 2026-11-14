'use client';

import { LogIn, Plus } from 'lucide-react';
import Link from 'next/link';
import { type ReactNode, useEffect, useRef, useState } from 'react';
import { Button, buttonVariants } from '@/components/ui/button';
import { Sheet, SheetContent, SheetTitle } from '@/components/ui/sheet';
import { type Language, textsFor } from '@/lib/i18n';
import { cn } from '@/lib/utils';
import { texts } from '../i18n';
import { JoinMissionForm } from './join-mission-form';

type Open = 'none' | 'join';
const JOIN_HASHES = ['#join', '#join-code'];

export function MissionsWorkspace({ lang, table }: { lang: Language; table: ReactNode }) {
  const t = textsFor(texts, lang);
  const [open, setOpen] = useState<Open>('none');
  const focusJoin = useRef(false);

  useEffect(() => {
    if (open !== 'join' || !focusJoin.current) return;
    focusJoin.current = false;
    const input = document.getElementById('join-code');
    input?.focus();
    input?.scrollIntoView({ block: 'center' });
  }, [open]);

  useEffect(() => {
    const sync = () => {
      if (!JOIN_HASHES.includes(window.location.hash)) return;
      focusJoin.current = true;
      setOpen('join');
    };
    sync();
    window.addEventListener('hashchange', sync);
    return () => window.removeEventListener('hashchange', sync);
  }, []);

  const toggle = (next: Open) => setOpen((current) => (current === next ? 'none' : next));

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="flex flex-col gap-1">
          <h1 className="text-xl font-semibold tracking-[-0.01em]">{t.missionsPageTitle}</h1>
          <p className="text-muted-foreground text-xs">{t.missionsPageSubtitle}</p>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            className="hit-area"
            aria-expanded={open === 'join'}
            aria-controls="join"
            onClick={() => {
              focusJoin.current = true;
              toggle('join');
            }}
          >
            <LogIn data-icon="inline-start" />
            {t.joinWithCode}
          </Button>
          <Link href="/missions/new" className={cn(buttonVariants(), 'hit-area')}>
            <Plus data-icon="inline-start" />
            {t.newMission}
          </Link>
        </div>
      </div>
      {table}
      <Sheet open={open !== 'none'} onOpenChange={(next) => (next ? null : setOpen('none'))}>
        <SheetContent
          side="right"
          className="gap-0 overflow-y-auto rounded-l-2xl p-0 data-[side=right]:w-full data-[side=right]:sm:max-w-[480px]"
        >
          <SheetTitle className="sr-only">{t.joinWithCode}</SheetTitle>
          {open === 'join' ? (
            <JoinMissionForm
              id="join"
              lang={lang}
              onCancel={() => setOpen('none')}
              className="rounded-none bg-transparent ring-0"
            />
          ) : null}
        </SheetContent>
      </Sheet>
    </div>
  );
}
