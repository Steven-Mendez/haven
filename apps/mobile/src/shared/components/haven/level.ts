import type { Level } from '@haven/core';
import {
  Activity,
  Brain,
  Dumbbell,
  HeartPulse,
  type LucideIcon,
  Radiation,
  Utensils,
} from 'lucide-react-native';

import type { ThemeZone } from '@/shared/lib/theme';

import { format, type HavenTexts } from './i18n';

export const LEVEL_TEXT_CLASS: Record<Level, string> = {
  green: 'text-level-green',
  amber: 'text-level-amber',
  red: 'text-level-red',
  pending: 'text-level-pending',
};

export const LEVEL_BG_CLASS: Record<Level, string> = {
  green: 'bg-level-green-bg',
  amber: 'bg-level-amber-bg',
  red: 'bg-level-red-bg',
  pending: 'bg-transparent',
};

export const LEVEL_BORDER_CLASS: Record<Level, string> = {
  green: 'border-level-green-border',
  amber: 'border-level-amber-border',
  red: 'border-level-red-border',
  pending: 'border-level-pending-border border-dashed',
};

export const LEVEL_BAR_CLASS: Record<Level, string> = {
  green: 'bg-border',
  amber: 'bg-border',
  red: 'bg-border',
  pending: 'bg-border',
};

export function levelLabel(t: HavenTexts, level: Level): string {
  return { green: t.levelGreen, amber: t.levelAmber, red: t.levelRed, pending: t.levelPending }[
    level
  ];
}

export function levelPhrase(t: HavenTexts, level: Level): string {
  return {
    green: t.phraseGreen,
    amber: t.phraseAmber,
    red: t.phraseRed,
    pending: t.phrasePending,
  }[level];
}

export const ZONE_ICON: Record<ThemeZone, LucideIcon> = {
  vitals: HeartPulse,
  mind: Brain,
  performance: Dumbbell,
  metabolism: Utensils,
  environment: Radiation,
};

export function zoneIcon(zone: string): LucideIcon {
  return ZONE_ICON[zone as ThemeZone] ?? Activity;
}

export function zoneName(t: HavenTexts, zone: string): string {
  const names: Record<ThemeZone, string> = {
    vitals: t.zoneVitals,
    mind: t.zoneMind,
    performance: t.zonePerformance,
    metabolism: t.zoneMetabolism,
    environment: t.zoneEnvironment,
  };
  return names[zone as ThemeZone] ?? zone;
}

export function zoneSummary(t: HavenTexts, levels: Level[]): string {
  const red = levels.filter((l) => l === 'red').length;
  const amber = levels.filter((l) => l === 'amber').length;
  if (red) return format(t.zoneEmergency, { n: red });
  if (amber) return format(t.zoneToReview, { n: amber });
  if (levels.length === 0 || levels.every((l) => l === 'pending')) return t.zoneNoReadings;
  return t.zoneInRange;
}
