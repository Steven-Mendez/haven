import Link from 'next/link';
import type { ReactNode } from 'react';
import type { Language } from '@/lib/i18n';
import { cn } from '@/lib/utils';
import { LevelGlyph } from './level-glyph';
import { levelLabel } from './levels';
import type { VisualLevel } from './types';

export type Stat = {
  label: string;
  value: ReactNode;
  unit?: string;
  level?: VisualLevel;
  href?: string;
  active?: boolean;
};

type Props = {
  items: Stat[];
  lang: Language;
  className?: string;
};

export function StatStrip({ items, lang, className }: Props) {
  return (
    <dl
      className={cn(
        'bg-border grid grid-cols-2 gap-px overflow-hidden rounded-xl border sm:auto-cols-fr sm:grid-flow-col sm:grid-cols-none',
        className,
      )}
    >
      {items.map((s) => {
        const figure = (
          <>
            <span className="text-[28px] leading-8 font-medium tracking-[-0.02em] tabular-nums">
              {s.value}
            </span>
            {s.unit ? <span className="text-tertiary text-sm tabular-nums">{s.unit}</span> : null}
          </>
        );
        return (
          <div
            key={s.label}
            className={cn(
              'bg-background md:bg-surface relative flex min-w-0 flex-col justify-between gap-1.5 px-4 py-3',
              s.href && 'hover:bg-hover focus-within:bg-hover transition-colors',
              s.active &&
                'after:bg-brand bg-hover md:bg-hover after:absolute after:inset-x-0 after:bottom-0 after:h-0.5',
            )}
          >
            <dt className="text-muted-foreground flex items-start gap-1.5 text-xs leading-4">
              {s.level ? (
                <span className="flex h-4 shrink-0 items-center">
                  <LevelGlyph level={s.level} size={10} />
                </span>
              ) : null}
              <span className="text-balance">{s.label}</span>
              {s.level ? <span className="sr-only"> ({levelLabel(s.level, lang)})</span> : null}
            </dt>
            <dd className="flex items-baseline gap-1">
              {s.href ? (
                <Link
                  href={s.href}
                  scroll={false}
                  aria-current={s.active ? 'true' : undefined}
                  className="focus-visible:before:ring-ring flex items-baseline gap-1 outline-none before:absolute before:inset-0 before:content-[''] focus-visible:before:ring-2 focus-visible:before:ring-inset"
                >
                  {figure}
                </Link>
              ) : (
                figure
              )}
            </dd>
          </div>
        );
      })}
    </dl>
  );
}
