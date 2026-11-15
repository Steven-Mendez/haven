'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { havenTexts } from '@/components/haven/texts';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Kbd, KbdGroup } from '@/components/ui/kbd';
import type { Language } from '@/lib/i18n';

const GO: Record<string, string> = {
  c: '/',
  r: '/rules',
  k: '/kpi',
  t: '/kpi',
  e: '/eva',
  a: '/reentry',
  p: '/medication',
  s: '/samples',
  x: '/exercise',
  v: '/motion',
  w: '/workload',
  m: '/missions',
};

const typing = (target: EventTarget | null) =>
  (target as HTMLElement | null)?.closest?.(
    'input, textarea, select, [contenteditable="true"], [role="dialog"], [role="menu"]',
  );

export function KeyboardShortcuts({ lang }: { lang: Language }) {
  const t = havenTexts[lang];
  const router = useRouter();
  const [open, setOpen] = useState(false);

  useEffect(() => {
    let pendingG = 0;
    const onKey = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey || typing(e.target)) return;
      if (e.key === '?') {
        e.preventDefault();
        setOpen((v) => !v);
        return;
      }
      if (e.key === 'g') {
        pendingG = Date.now();
        return;
      }
      const href = GO[e.key];
      if (href && Date.now() - pendingG < 1200) {
        e.preventDefault();
        pendingG = 0;
        router.push(href);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [router]);

  const rows: { keys: string[][]; label: string }[] = [
    { keys: [['⌘', 'K']], label: t.shortcutOpenMenu },
    { keys: [['j'], ['k']], label: t.shortcutMove },
    { keys: [['↵']], label: t.shortcutOpen },
    { keys: [['g', 'c']], label: t.shortcutGoCrew },
    { keys: [['g', 'r']], label: t.shortcutGoRules },
    { keys: [['g', 'k']], label: t.shortcutGoKpi },
    { keys: [['g', 'e']], label: t.shortcutGoEva },
    { keys: [['g', 'a']], label: t.shortcutGoReentry },
    { keys: [['g', 'p']], label: t.shortcutGoMedication },
    { keys: [['g', 's']], label: t.shortcutGoSamples },
    { keys: [['g', 'x']], label: t.shortcutGoExercise },
    { keys: [['g', 'v']], label: t.shortcutGoMotion },
    { keys: [['g', 'w']], label: t.shortcutGoWorkload },
    { keys: [['g', 'm']], label: t.shortcutGoMissions },
    { keys: [['⌘', 'B']], label: t.shortcutSidebar },
    { keys: [['?']], label: t.shortcutHelp },
    { keys: [['esc']], label: t.shortcutClose },
  ];

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent showCloseButton={false} className="gap-0 p-0 sm:max-w-md">
        <DialogHeader className="border-b px-4 py-3">
          <DialogTitle className="text-sm font-semibold">{t.shortcutsTitle}</DialogTitle>
          <DialogDescription className="text-xs">{t.shortcutsDescription}</DialogDescription>
        </DialogHeader>
        <dl className="divide-border-subtle flex flex-col divide-y px-4 py-1">
          {rows.map((r) => (
            <div key={r.label} className="flex h-9 items-center justify-between gap-4">
              <dt className="text-sm">{r.label}</dt>
              <dd className="flex items-center gap-1.5">
                {r.keys.map((combo) => (
                  <KbdGroup key={combo.join('+')}>
                    {combo.map((k) => (
                      <Kbd key={k}>{k}</Kbd>
                    ))}
                  </KbdGroup>
                ))}
              </dd>
            </div>
          ))}
        </dl>
      </DialogContent>
    </Dialog>
  );
}
