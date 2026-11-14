import type { Level } from '@haven/core';

import { Badge } from '@/shared/components/ui/badge';
import { Text } from '@/shared/components/ui/text';
import { useTexts } from '@/shared/i18n';
import { cn } from '@/shared/lib/utils';

import { havenTexts } from './i18n';
import {
  LEVEL_BG_CLASS,
  LEVEL_BORDER_CLASS,
  LEVEL_TEXT_CLASS,
  levelLabel,
  levelPhrase,
} from './level';
import { LevelSymbol } from './level-symbol';

type Props = {
  level: Level;
  size?: 'sm' | 'md' | 'lg';
  label?: string;
  symbolOnly?: boolean;
  className?: string;
};

const SIZE = {
  sm: { box: 'h-5 px-1.5 gap-1', text: 'text-[12px]', symbol: 8, only: 'w-5' },
  md: { box: 'h-6 px-1.5 gap-1', text: 'text-[13px]', symbol: 10, only: 'w-6' },
  lg: { box: 'h-7 px-2 gap-1.5', text: 'text-[15px]', symbol: 12, only: 'w-7' },
} as const;

export function LevelBadge({ level, size = 'md', label, symbolOnly = false, className }: Props) {
  const t = useTexts(havenTexts);
  const s = SIZE[size];
  const text = label ?? levelLabel(t, level);
  return (
    <Badge
      variant="outline"
      accessible
      accessibilityRole="text"
      accessibilityLabel={`${t.level}: ${text}. ${levelPhrase(t, level)}`}
      className={cn(
        'self-start rounded-sm py-0',
        s.box,
        LEVEL_BG_CLASS[level],
        LEVEL_BORDER_CLASS[level],
        symbolOnly && cn(s.only, 'border-0 bg-transparent px-0'),
        className,
      )}
    >
      <LevelSymbol level={level} size={s.symbol} />
      {symbolOnly ? null : (
        <Text className={cn('font-medium', s.text, LEVEL_TEXT_CLASS[level])}>{text}</Text>
      )}
    </Badge>
  );
}
