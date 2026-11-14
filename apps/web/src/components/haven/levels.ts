import type { Level } from '@haven/core';
import { format, formatDuration, type Language, minutesBetween } from '@/lib/i18n';
import { havenTexts } from './texts';
import type { Now, VisualLevel } from './types';

type LevelMeta = {
  symbol: string;
  key: 'levelGreen' | 'levelAmber' | 'levelRed' | 'levelPending' | 'noData';
  text: string;
  bg: string;
  border: string;
};

export const LEVELS: Record<VisualLevel, LevelMeta> = {
  green: {
    symbol: '●',
    key: 'levelGreen',
    text: 'text-level-green',
    bg: 'bg-level-green-bg',
    border: 'border-level-green-border',
  },
  amber: {
    symbol: '◐',
    key: 'levelAmber',
    text: 'text-level-amber',
    bg: 'bg-level-amber-bg',
    border: 'border-level-amber-border',
  },
  red: {
    symbol: '▲',
    key: 'levelRed',
    text: 'text-level-red',
    bg: 'bg-level-red-bg',
    border: 'border-level-red-border',
  },
  pending: {
    symbol: '○',
    key: 'levelPending',
    text: 'text-level-pending',
    bg: 'bg-transparent',
    border: 'border-level-pending-border border-dashed',
  },
  'no-data': {
    symbol: '◷',
    key: 'noData',
    text: 'text-level-pending',
    bg: 'bg-transparent',
    border: 'border-level-pending-border border-dashed',
  },
};

export const LEVEL_ORDER: Record<VisualLevel, number> = {
  red: 0,
  amber: 1,
  'no-data': 2,
  pending: 3,
  green: 4,
};

export function levelLabel(level: VisualLevel, lang: Language): string {
  return havenTexts[lang][LEVELS[level].key];
}

export function bySeverity<T>(items: T[], levelOf: (item: T) => VisualLevel): T[] {
  return [...items].sort((a, b) => LEVEL_ORDER[levelOf(a)] - LEVEL_ORDER[levelOf(b)]);
}

export function worstLevel(levels: Level[]): Level {
  if (!levels.length) return 'pending';
  return bySeverity(levels, (l) => l)[0] ?? 'pending';
}

export function countLevels(levels: Level[]): Record<Level, number> {
  const count: Record<Level, number> = { green: 0, amber: 0, red: 0, pending: 0 };
  for (const l of levels) count[l] += 1;
  return count;
}

export const ZONE_ORDER = [
  'heart',
  'lungs',
  'head',
  'metabolism',
  'musculoskeletal',
  'skin',
  'mind',
] as const;

export function ago(from: string, now: Now): string {
  return formatDuration(minutesBetween(from, now));
}

export function lastDataText(from: string, now: Now, lang: Language): string {
  const t = havenTexts[lang];
  const min = minutesBetween(from, now);
  return min < 1 ? t.lastDataNow : format(t.lastData, { t: formatDuration(min) });
}
