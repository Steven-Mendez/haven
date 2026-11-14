import { Badge } from '@/components/ui/badge';
import type { Language } from '@/lib/i18n';
import { cn } from '@/lib/utils';
import { LevelGlyph } from './level-glyph';
import { LEVELS, levelLabel } from './levels';
import { havenTexts } from './texts';
import type { VisualLevel } from './types';

type Props = {
  level: VisualLevel;
  lang: Language;
  /** Overrides the default label («Check»…), e.g. EVA categories. The shape always stays. */
  label?: string;
  size?: 'sm' | 'md' | 'lg';
  /** Shape only (label kept for screen readers and as tooltip). Use only next to text that names the thing. */
  symbolOnly?: boolean;
  /** Greys the badge out (shape and label stay): last known level of a stale crew member. */
  muted?: boolean;
  /** Reads «Level: …» to screen readers (default). Turn off when the badge is not a health level (e.g. rule delivery). */
  prefix?: boolean;
  className?: string;
};

// Heights 20 · 22 · 26, radius 6 (SPEC §4: chips).
const SIZES = {
  sm: 'h-5 gap-1 px-1.5 text-xs',
  md: 'h-[22px] gap-1.5 px-2 text-xs',
  lg: 'h-[26px] gap-1.5 px-2.5 text-sm',
};
const GLYPH = { sm: 10, md: 10, lg: 11 };
const SQUARE = { sm: 'size-5', md: 'size-[22px]', lg: 'size-[26px]' };

/**
 * Level chip (SPEC §2 «Niveles»): shape + label in the level colour, 12 % tint, 24 % border, radius 6.
 * ● In range · ◐ Check · ▲ Emergency · ○ Pending (dashed) · ◷ No recent data (dashed).
 * `symbolOnly` drops the chip and shows the bare shape (the label stays for screen readers).
 */
export function LevelBadge({
  level,
  lang,
  label,
  size = 'md',
  symbolOnly,
  muted,
  prefix = true,
  className,
}: Props) {
  const meta = LEVELS[level];
  const text = label ?? levelLabel(level, lang);
  const sr = (
    <>
      {prefix ? <span className="sr-only">{havenTexts[lang].levelPrefix}: </span> : null}
      <span className={symbolOnly ? 'sr-only' : undefined}>{text}</span>
    </>
  );

  if (symbolOnly) {
    return (
      <span
        data-level={level}
        title={text}
        className={cn('inline-flex shrink-0 items-center justify-center', SQUARE[size], className)}
      >
        <LevelGlyph level={level} size={GLYPH[size] + 1} muted={muted} />
        {sr}
      </span>
    );
  }

  return (
    <Badge
      variant="outline"
      data-level={level}
      className={cn(
        'rounded-md font-medium',
        muted
          ? 'border-border text-muted-foreground bg-transparent'
          : [meta.text, meta.bg, meta.border],
        SIZES[size],
        className,
      )}
    >
      {/* Wrapped: Badge forces direct svg children to 12 px. */}
      <span className="inline-flex">
        <LevelGlyph level={level} size={GLYPH[size]} muted={muted} />
      </span>
      {sr}
    </Badge>
  );
}
