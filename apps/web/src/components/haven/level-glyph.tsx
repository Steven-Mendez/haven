import type { Language } from '@/lib/i18n';
import { cn } from '@/lib/utils';
import { LEVELS, levelLabel } from './levels';
import { havenTexts } from './texts';
import type { VisualLevel } from './types';

type Props = {
  level: VisualLevel;
  size?: number;
  lang?: Language;
  muted?: boolean;
  pulse?: boolean;
  round?: boolean;
  className?: string;
};

export function LevelGlyph({ level, size = 10, lang, muted, pulse, round, className }: Props) {
  const label = lang ? `${havenTexts[lang].levelPrefix}: ${levelLabel(level, lang)}` : undefined;
  return (
    <svg
      viewBox="0 0 12 12"
      width={size}
      height={size}
      role={label ? 'img' : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : true}
      data-level={level}
      className={cn(
        'shrink-0',
        muted ? 'text-tertiary' : LEVELS[level].text,
        pulse && 'motion-safe:animate-live',
        className,
      )}
    >
      {level === 'green' ? <circle cx="6" cy="6" r="5" fill="currentColor" /> : null}
      {level === 'amber' ? (
        <>
          <circle cx="6" cy="6" r="4.5" fill="none" stroke="currentColor" strokeWidth="1.5" />
          <path d="M6 1.5a4.5 4.5 0 0 1 0 9z" fill="currentColor" />
        </>
      ) : null}
      {level === 'red' ? (
        round ? (
          <circle cx="6" cy="6" r="5" fill="currentColor" />
        ) : (
          <path d="M6 1.2 11.2 10.5H0.8z" fill="currentColor" />
        )
      ) : null}
      {level === 'pending' ? (
        <circle
          cx="6"
          cy="6"
          r="4.5"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeDasharray="2.2 1.6"
        />
      ) : null}
      {level === 'no-data' ? (
        <>
          <circle
            cx="6"
            cy="6"
            r="4.75"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.3"
            strokeDasharray="2.2 1.6"
          />
          <path d="M6 3.4V6l1.7 1.1" fill="none" stroke="currentColor" strokeWidth="1.2" />
        </>
      ) : null}
    </svg>
  );
}
