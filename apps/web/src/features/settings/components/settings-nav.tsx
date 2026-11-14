'use client';

import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

export type SettingsSection = { id: string; label: string };

/**
 * Linear-style settings sub-nav (sticks below the 44 px app header, `top-16`): 28 px items, the section in view marked with the active fill. shadcn
 * `Button`s rendered as plain anchors (work without JavaScript); the active item follows the scroll
 * with an IntersectionObserver.
 */
export function SettingsNav({ label, sections }: { label: string; sections: SettingsSection[] }) {
  const [active, setActive] = useState(sections[0]?.id);

  useEffect(() => {
    const targets = sections
      .map((s) => document.getElementById(s.id))
      .filter((el): el is HTMLElement => el !== null);
    // The callback only receives the sections whose visibility changed, so keep every section's state and
    // mark the topmost visible one (not the topmost of the batch).
    const inView = new Map<string, boolean>();
    const observer = new IntersectionObserver(
      (entries) => {
        for (const e of entries) inView.set(e.target.id, e.isIntersecting);
        const first = sections.find((s) => inView.get(s.id));
        if (first) setActive(first.id);
      },
      // Top margin = the 44 px sticky app header: a section hidden under it is not «in view» (anchors land at 64 px).
      { rootMargin: '-48px 0px -60% 0px' },
    );
    for (const el of targets) observer.observe(el);
    return () => observer.disconnect();
  }, [sections]);

  return (
    <nav aria-label={label} className="md:sticky md:top-16 md:self-start">
      <ul className="flex gap-1 md:flex-col md:gap-0.5">
        {sections.map((s) => (
          <li key={s.id}>
            <Button
              variant="ghost"
              size="sm"
              nativeButton={false}
              render={<a href={`#${s.id}`} />}
              aria-current={active === s.id ? 'location' : undefined}
              onClick={() => setActive(s.id)}
              className={cn(
                'text-muted-foreground hover:bg-hover hover:text-foreground flex h-7 justify-start rounded-md px-2 text-sm font-normal',
                'aria-[current=location]:bg-active aria-[current=location]:text-foreground aria-[current=location]:font-medium',
              )}
            >
              {s.label}
            </Button>
          </li>
        ))}
      </ul>
    </nav>
  );
}
