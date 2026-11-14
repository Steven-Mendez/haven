'use client';

import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

export type SettingsSection = { id: string; label: string };

export function SettingsNav({ label, sections }: { label: string; sections: SettingsSection[] }) {
  const [active, setActive] = useState(sections[0]?.id);

  useEffect(() => {
    const targets = sections
      .map((s) => document.getElementById(s.id))
      .filter((el): el is HTMLElement => el !== null);
    const inView = new Map<string, boolean>();
    const observer = new IntersectionObserver(
      (entries) => {
        for (const e of entries) inView.set(e.target.id, e.isIntersecting);
        const first = sections.find((s) => inView.get(s.id));
        if (first) setActive(first.id);
      },
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
