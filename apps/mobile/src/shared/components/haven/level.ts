import type { Level } from '@haven/core';
import {
  Activity,
  Bone,
  Brain,
  Eye,
  Heart,
  type LucideIcon,
  Sun,
  Utensils,
  Wind,
} from 'lucide-react-native';

import type { ThemeZone } from '@/shared/lib/theme';

import { format, type HavenTexts } from './i18n';

// Literal class maps (NativeWind only picks up classes written in full).
// Each level is a solid trio: text (fg), fill (bg) and 1 px border. Pending: no fill, dashed.

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

/**
 * @deprecated Cards no longer carry a level-tinted bar (DESIGN_SYSTEM.md §1.2 #10): the badge
 * and symbol say the level. Kept as a neutral border colour so old imports still compile.
 */
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

// Zones are identified by name and line icon, never by colour (DESIGN_SYSTEM.md §1.2 #3).

/** Line icon per zone: zones are identified by name and icon, never by colour. */
export const ZONE_ICON: Record<ThemeZone, LucideIcon> = {
  heart: Heart,
  lungs: Wind,
  head: Eye,
  metabolism: Utensils,
  musculoskeletal: Bone,
  skin: Sun,
  mind: Brain,
};

export function zoneIcon(zone: string): LucideIcon {
  return ZONE_ICON[zone as ThemeZone] ?? Activity;
}

export function zoneName(t: HavenTexts, zone: string): string {
  const names: Record<ThemeZone, string> = {
    heart: t.zoneHeart,
    lungs: t.zoneLungs,
    head: t.zoneHead,
    metabolism: t.zoneMetabolism,
    musculoskeletal: t.zoneMusculoskeletal,
    skin: t.zoneSkin,
    mind: t.zoneMind,
  };
  return names[zone as ThemeZone] ?? zone;
}

/** Grey summary line for a zone row from its indicators' levels: "2 to check", "All in range"… */
export function zoneSummary(t: HavenTexts, levels: Level[]): string {
  const red = levels.filter((l) => l === 'red').length;
  const amber = levels.filter((l) => l === 'amber').length;
  if (red) return format(t.zoneEmergency, { n: red });
  if (amber) return format(t.zoneToReview, { n: amber });
  if (levels.length === 0 || levels.every((l) => l === 'pending')) return t.zoneNoReadings;
  return t.zoneInRange;
}
