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
  label?: string;
  size?: 'sm' | 'md' | 'lg';
  symbolOnly?: boolean;
  muted?: boolean;
  prefix?: boolean;
  className?: string;
};

const SIZES = {
  sm: 'h-5 gap-1 px-1.5 text-xs',
  md: 'h-[22px] gap-1.5 px-2 text-xs',
  lg: 'h-[26px] gap-1.5 px-2.5 text-sm',
};
const GLYPH = { sm: 10, md: 10, lg: 11 };
const SQUARE = { sm: 'size-5', md: 'size-[22px]', lg: 'size-[26px]' };

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
      <span className="inline-flex">
        <LevelGlyph level={level} size={GLYPH[size]} muted={muted} />
      </span>
      {sr}
    </Badge>
  );
}
