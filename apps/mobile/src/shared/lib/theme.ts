import { DarkTheme, DefaultTheme, type Theme } from 'expo-router';
import { useColorScheme } from 'nativewind';
import { Platform } from 'react-native';

export type Scheme = 'light' | 'dark';

export const DEFAULT_SCHEME: Scheme = 'dark';

export const THEME = {
  light: {
    background: 'hsl(0 0% 100%)',
    foreground: 'hsl(240 4.8% 4.1%)',
    card: 'hsl(0 0% 100%)',
    cardForeground: 'hsl(240 4.8% 4.1%)',
    popover: 'hsl(0 0% 100%)',
    popoverForeground: 'hsl(240 4.8% 4.1%)',
    primary: 'hsl(240 4.8% 4.1%)',
    primaryForeground: 'hsl(0 0% 100%)',
    secondary: 'hsl(240 4% 95.1%)',
    secondaryForeground: 'hsl(240 4.8% 4.1%)',
    muted: 'hsl(240 4% 95.1%)',
    mutedForeground: 'hsl(240 4.1% 38.4%)',
    accent: 'hsl(240 4% 95.1%)',
    accentForeground: 'hsl(240 4.8% 4.1%)',
    destructive: 'hsl(354 100% 42.2%)',
    destructiveForeground: 'hsl(0 0% 100%)',
    border: 'hsl(240 4.2% 90.6%)',
    input: 'hsl(240 4.9% 83.9%)',
    ring: 'hsl(211 100% 50%)',
    brand: 'hsl(211 100% 50%)',
    radius: '0.75rem',
    chart1: 'hsl(240 4.8% 4.1%)',
    chart2: 'hsl(211 100% 50%)',
    chart3: 'hsl(240 4.1% 38.4%)',
    chart4: 'hsl(240 3.9% 44.9%)',
    chart5: 'hsl(240 4.9% 72%)',
  },
  dark: {
    background: 'hsl(0 0% 0%)',
    foreground: 'hsl(240 5.6% 92.9%)',
    card: 'hsl(240 6.3% 6.3%)',
    cardForeground: 'hsl(240 5.6% 92.9%)',
    popover: 'hsl(240 8.3% 9.4%)',
    popoverForeground: 'hsl(240 5.6% 92.9%)',
    primary: 'hsl(240 4.8% 95.9%)',
    primaryForeground: 'hsl(0 0% 0%)',
    secondary: 'hsl(240 6.7% 11.8%)',
    secondaryForeground: 'hsl(240 5.6% 92.9%)',
    muted: 'hsl(240 6.7% 11.8%)',
    mutedForeground: 'hsl(240 4.2% 62.4%)',
    accent: 'hsl(240 6.7% 11.8%)',
    accentForeground: 'hsl(240 5.6% 92.9%)',
    destructive: 'hsl(3 100% 61.4%)',
    destructiveForeground: 'hsl(0 0% 100%)',
    border: 'hsl(240 5.4% 14.5%)',
    input: 'hsl(206 6.9% 19.8%)',
    ring: 'hsl(210 100% 52%)',
    brand: 'hsl(210 100% 52%)',
    radius: '0.75rem',
    chart1: 'hsl(240 5.6% 92.9%)',
    chart2: 'hsl(210 100% 52%)',
    chart3: 'hsl(240 4.2% 62.4%)',
    chart4: 'hsl(240 4.1% 52.2%)',
    chart5: 'hsl(240 4.8% 28.4%)',
  },
};

export const NAV_THEME: Record<Scheme, Theme> = {
  light: {
    ...DefaultTheme,
    colors: {
      background: THEME.light.background,
      border: THEME.light.border,
      card: THEME.light.background,
      notification: THEME.light.destructive,
      primary: THEME.light.foreground,
      text: THEME.light.foreground,
    },
  },
  dark: {
    ...DarkTheme,
    colors: {
      background: THEME.dark.background,
      border: THEME.dark.border,
      card: THEME.dark.background,
      notification: THEME.dark.destructive,
      primary: THEME.dark.foreground,
      text: THEME.dark.foreground,
    },
  },
};

export const LEVELS = ['green', 'amber', 'red', 'pending'] as const;
export type ThemeLevel = (typeof LEVELS)[number];

export const SEVERITY: Record<ThemeLevel, number> = { red: 3, amber: 2, pending: 1, green: 0 };

export const LEVEL_SYMBOL: Record<ThemeLevel, string> = {
  green: '●',
  amber: '◐',
  red: '▲',
  pending: '○',
};

export const LEVEL_SYMBOL_SIZE = { dot: 6, inline: 8, badge: 10, header: 12 } as const;

export const ZONES = [
  'heart',
  'lungs',
  'head',
  'metabolism',
  'musculoskeletal',
  'skin',
  'mind',
] as const;
export type ThemeZone = (typeof ZONES)[number];

type LevelColors = { fg: string; bg: string; border: string };

export type Palette = {
  background: string;
  surface: string;
  foreground: string;
  card: string;
  elevated: string;
  muted: string;
  hover: string;
  active: string;
  secondary: string;
  mutedForeground: string;
  tertiary: string;
  disabled: string;
  borderSubtle: string;
  border: string;
  borderStrong: string;
  input: string;
  primary: string;
  primaryForeground: string;
  focus: string;
  link: string;
  accent: string;
  accentSubtle: string;
  destructive: string;
  destructiveForeground: string;
  level: Record<ThemeLevel, LevelColors>;
  chart: {
    line: string;
    baseline: string;
    band: string;
    now: string;
    gap: string;
    reference: string;
    grid: string;
    axis: string;
    cursor: string;
    median: string;
    series: string[];
  };
  ring: { done: string; track: string; partial: string };
  zone: Record<ThemeZone, string>;
};

const neutralZones = (c: string): Record<ThemeZone, string> =>
  Object.fromEntries(ZONES.map((z) => [z, c])) as Record<ThemeZone, string>;

export const COLORS: Record<Scheme, Palette> = {
  dark: {
    background: '#000000',
    surface: '#0a0a0b',
    foreground: '#ececee',
    card: '#0f0f11',
    elevated: '#16161a',
    muted: '#1c1c20',
    hover: 'rgba(255, 255, 255, 0.04)',
    active: 'rgba(255, 255, 255, 0.07)',
    secondary: '#9b9ba3',
    mutedForeground: '#9b9ba3',
    tertiary: '#80808a',
    disabled: '#45454c',
    borderSubtle: '#16161a',
    border: '#232327',
    borderStrong: '#2f3336',
    input: '#2f3336',
    primary: '#f4f4f5',
    primaryForeground: '#000000',
    focus: '#0a84ff',
    link: '#0a84ff',
    accent: '#0a84ff',
    accentSubtle: 'rgba(10, 132, 255, 0.16)',
    destructive: '#ff453a',
    destructiveForeground: '#ffffff',
    level: {
      green: { fg: '#30d158', bg: 'rgba(48, 209, 88, 0.12)', border: 'rgba(48, 209, 88, 0.24)' },
      amber: { fg: '#ff9f0a', bg: 'rgba(255, 159, 10, 0.12)', border: 'rgba(255, 159, 10, 0.24)' },
      red: { fg: '#ff453a', bg: 'rgba(255, 69, 58, 0.12)', border: 'rgba(255, 69, 58, 0.24)' },
      pending: { fg: '#8e8e93', bg: 'transparent', border: '#2f3336' },
    },
    chart: {
      line: '#ececee',
      baseline: '#80808a',
      band: 'rgba(236, 236, 238, 0.06)',
      now: '#80808a',
      gap: 'rgba(236, 236, 238, 0.04)',
      reference: '#2f3336',
      grid: '#16161a',
      axis: '#80808a',
      cursor: '#0a84ff',
      median: '#80808a',
      series: ['#ececee', '#0a84ff', '#9b9ba3', '#80808a', '#45454c'],
    },
    ring: { done: '#0a84ff', track: '#1c1c20', partial: '#9b9ba3' },
    zone: neutralZones('#9b9ba3'),
  },
  light: {
    background: '#ffffff',
    surface: '#fafafa',
    foreground: '#0a0a0b',
    card: '#ffffff',
    elevated: '#ffffff',
    muted: '#f2f2f3',
    hover: 'rgba(0, 0, 0, 0.04)',
    active: 'rgba(0, 0, 0, 0.06)',
    secondary: '#5e5e66',
    mutedForeground: '#5e5e66',
    tertiary: '#6e6e77',
    disabled: '#b4b4bb',
    borderSubtle: '#f0f0f1',
    border: '#e6e6e8',
    borderStrong: '#d4d4d8',
    input: '#d4d4d8',
    primary: '#0a0a0b',
    primaryForeground: '#ffffff',
    focus: '#007aff',
    link: '#007aff',
    accent: '#007aff',
    accentSubtle: 'rgba(0, 122, 255, 0.10)',
    destructive: '#d70015',
    destructiveForeground: '#ffffff',
    level: {
      green: { fg: '#248a3d', bg: 'rgba(36, 138, 61, 0.12)', border: 'rgba(36, 138, 61, 0.24)' },
      amber: { fg: '#c93400', bg: 'rgba(201, 52, 0, 0.12)', border: 'rgba(201, 52, 0, 0.24)' },
      red: { fg: '#d70015', bg: 'rgba(215, 0, 21, 0.12)', border: 'rgba(215, 0, 21, 0.24)' },
      pending: { fg: '#6c6c70', bg: 'transparent', border: '#d4d4d8' },
    },
    chart: {
      line: '#0a0a0b',
      baseline: '#6e6e77',
      band: 'rgba(10, 10, 11, 0.06)',
      now: '#6e6e77',
      gap: 'rgba(10, 10, 11, 0.04)',
      reference: '#d4d4d8',
      grid: '#f0f0f1',
      axis: '#6e6e77',
      cursor: '#007aff',
      median: '#6e6e77',
      series: ['#0a0a0b', '#007aff', '#5e5e66', '#6e6e77', '#b4b4bb'],
    },
    ring: { done: '#007aff', track: '#f2f2f3', partial: '#5e5e66' },
    zone: neutralZones('#5e5e66'),
  },
};

export const RINGS = {
  routine: { light: '#0e9fc2', dark: '#4fd2ec' },
  measurements: { light: '#3a6ff0', dark: '#6b93ff' },
  wellbeing: { light: '#7b5cf0', dark: '#b88cff' },
} as const;
export type RingId = keyof typeof RINGS;
export const RING_TRACK_OPACITY: Record<Scheme, number> = { dark: 0.2, light: 0.14 };

export function useRingColor(id: RingId): string {
  const { colorScheme } = useColorScheme();
  return RINGS[id][colorScheme ?? DEFAULT_SCHEME];
}

export function useColors(): Palette {
  const { colorScheme } = useColorScheme();
  return COLORS[colorScheme ?? DEFAULT_SCHEME];
}

export const MOTION = {
  micro: 100,
  standard: 160,
  enter: 240,
  figure: 400,
  hold: 3000,
  fast: 100,
  base: 160,
  slow: 240,
} as const;

export const EASING = { standard: [0.16, 1, 0.3, 1] } as const;

export const TOUCH = {
  min: 44,
  row: 52,
  indicatorRow: 60,
  settingsRow: 44,
  primary: 52,
  sos: 72,
  large: 60,
  triage: 96,
} as const;

export const SPACE = {
  1: 4,
  2: 8,
  3: 12,
  4: 16,
  5: 20,
  6: 24,
  7: 28,
  8: 32,
  12: 48,
  screen: 16,
  section: 24,
  heroToList: 32,
  separatorInset: 16,
  card: 16,
  sosInset: 24,
} as const;

export const ICON_STROKE = { default: 1.75, small: 2 } as const;

export const MONO_FONT = Platform.select({
  ios: 'Menlo',
  android: 'monospace',
  default: 'monospace',
});
