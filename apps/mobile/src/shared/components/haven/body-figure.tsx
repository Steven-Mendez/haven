import type { Level } from '@haven/core';
import { ChevronRight } from 'lucide-react-native';
import { Platform, View } from 'react-native';
import { G, Path, Polygon, Svg } from 'react-native-svg';

import { Button } from '@/shared/components/ui/button';
import { Icon } from '@/shared/components/ui/icon';
import { Text, TextClassContext } from '@/shared/components/ui/text';
import { useTexts } from '@/shared/i18n';
import { SEVERITY, type ThemeZone, useColors, ZONES } from '@/shared/lib/theme';
import { cn } from '@/shared/lib/utils';

import { FRONT_HEAD, FRONT_OUTLINE } from './body-figure-paths';
import { havenTexts } from './i18n';
import { LEVEL_TEXT_CLASS, levelLabel, zoneIcon, zoneName } from './level';
import { LevelMeter } from './level-symbol';

/** Quiet base silhouette (fill) and its neutral edge; pending organs are mid grey, never a level. */
const BASE = { dark: '#1c1c20', light: '#f2f2f3' } as const;
const EDGE = { dark: '#2f3336', light: '#d4d4d8' } as const;
const PENDING = { dark: '#5a5a60', light: '#a1a1aa' } as const;

// Visible part of the 724 × 1448 canvas of the vendored silhouette (body-figure-paths.ts).
const VB = { x: 40, y: 92, w: 644, h: 1270 };

/**
 * Organ shapes (flat, smooth, no inner strokes) in the silhouette's canvas. Only organs that map to
 * real HAVEN zones (packages/core/config/zones.json + indicators.json):
 * brain → mind (mood, stress, sleep) · eyes → head and eyes (visual acuity, reaction, attention,
 * memory) · lungs → lungs (SpO₂, cabin CO₂) · heart → heart (rate, HRV, rhythm, pressure) ·
 * stomach → metabolism (glucose, temperature, weight, food) · femurs → bones and muscles (bone loss,
 * exercise, steps) · the silhouette edge → skin and body (radiation dose, solar events).
 */
const ORGANS: { zone: ThemeZone; d: string }[] = [
  // Brain: two hemispheres with a narrow gap.
  {
    zone: 'mind',
    d: 'M 359 104 C 333 102 310 116 305 140 C 301 160 311 175 331 179 C 344 181 354 178 359 172 Z M 369 104 C 395 102 418 116 423 140 C 427 160 417 175 397 179 C 384 181 374 178 369 172 Z',
  },
  // Eyes: two small almonds.
  {
    zone: 'head',
    d: 'M 330 200 C 336 191 352 191 358 200 C 352 209 336 209 330 200 Z M 370 200 C 376 191 392 191 398 200 C 392 209 376 209 370 200 Z',
  },
  // Lungs: right lung (viewer's left) and left lung with the cardiac notch.
  {
    zone: 'lungs',
    d: 'M 340 312 C 316 314 292 340 281 378 C 271 414 270 456 278 490 C 296 500 326 494 350 478 C 356 436 357 370 352 334 C 350 320 346 312 340 312 Z M 388 312 C 412 314 436 340 447 378 C 457 414 458 456 450 490 C 445 496 438 498 432 497 C 434 470 430 444 420 422 C 412 404 400 392 393 380 C 388 362 386 340 386 326 C 386 318 387 312 388 312 Z',
  },
  // Heart: rounded, apex down and to the body's left.
  {
    zone: 'heart',
    d: 'M 359 410 C 359 390 374 380 390 384 C 405 388 415 400 419 416 C 425 440 425 464 421 488 C 405 486 387 478 373 466 C 363 456 359 434 359 410 Z',
  },
  // Stomach.
  {
    zone: 'metabolism',
    d: 'M 364 522 C 372 506 398 500 418 506 C 440 514 452 536 447 560 C 442 584 418 600 390 600 C 366 600 347 590 343 574 C 340 562 349 553 360 553 C 368 553 372 546 368 538 C 364 532 360 528 364 522 Z',
  },
  // Femurs: shaft with rounded ends, one per thigh.
  {
    zone: 'musculoskeletal',
    d: 'M 282 770 C 270 760 278 742 294 747 C 304 738 324 745 319 760 C 316 769 311 776 311 787 L 309 886 C 318 891 324 905 314 913 C 306 919 296 915 293 909 C 285 917 270 911 274 899 C 277 891 286 888 289 884 L 289 789 C 289 780 288 774 282 770 Z M 446 770 C 458 760 450 742 434 747 C 424 738 404 745 409 760 C 412 769 417 776 417 787 L 419 886 C 410 891 404 905 414 913 C 422 919 432 915 435 909 C 443 917 458 911 454 899 C 451 891 442 888 439 884 L 439 789 C 439 780 440 774 446 772 Z',
  },
];

/** Generous invisible hit areas per organ (partition of the torso / head), in canvas units. */
const HITS: { zone: ThemeZone; points: string }[] = [
  { zone: 'mind', points: '200,92 528,92 528,184 200,184' },
  { zone: 'head', points: '200,184 528,184 528,250 200,250' },
  {
    zone: 'lungs',
    points: '240,296 488,296 488,380 432,380 432,496 340,496 340,380 240,380 240,296',
  },
  { zone: 'heart', points: '340,380 432,380 432,496 340,496' },
  { zone: 'metabolism', points: '240,496 488,496 488,650 240,650' },
  { zone: 'musculoskeletal', points: '236,700 492,700 492,960 236,960' },
];

/**
 * Press + accessibility props for an SVG group. Native: onPress/accessible/accessibilityLabel.
 * Web: react-native-web forwards those to the DOM, so use onClick + aria-label + role instead.
 */
function svgZoneProps(onPress: (() => void) | undefined, label: string): Record<string, unknown> {
  if (Platform.OS === 'web')
    return onPress
      ? { onClick: onPress, 'aria-label': label, role: 'button' }
      : { 'aria-label': label, role: 'img' };
  return onPress
    ? { onPress, accessible: true, accessibilityLabel: label }
    : { accessible: true, accessibilityLabel: label };
}

type Props = {
  /** Level per zone (`evaluateZones()` output works as-is). Missing zones are pending. */
  zones: { zone: string; level: Level }[];
  /** Highlighted zone (the one whose detail is open). */
  selected?: string;
  onPressZone?: (zone: ThemeZone) => void;
  /** Zone names from the config (`Zone.name[lang]`); falls back to built-in names. */
  names?: Partial<Record<string, string>>;
  /** Grey line under each zone in the list ("2 to check"). See `zoneSummary`. */
  details?: Partial<Record<string, string>>;
  /** Figure height in pt. Default 280. */
  height?: number;
  /** The zone list under the figure (accessible alternative). Default true. */
  showLegend?: boolean;
  className?: string;
};

/**
 * Front body silhouette with organs (Tonal aesthetic, medical-illustration minimalism): a quiet
 * dark-grey body and, on top, only the organs HAVEN measures, each a flat shape filled with its
 * level colour (in range green · check amber · emergency red · pending mid grey). No icons or inner
 * lines. Each organ is pressable (large invisible hit area) and labelled «zone, level»; the level
 * is always also given in text by the level sections under the figure.
 */
export function BodyFigure({
  zones,
  selected,
  onPressZone,
  names,
  details,
  height = 280,
  showLegend = true,
  className,
}: Props) {
  const colors = useColors();
  const t = useTexts(havenTexts);
  const scheme = colors.background === '#000000' ? 'dark' : 'light';
  const width = (height * VB.w) / VB.h;
  // Gap around the heart (it overlaps the lungs) ≈ 1.25 pt, in canvas units.
  const gap = (1.25 * VB.h) / height;

  const levelOf = (zone: ThemeZone): Level =>
    zones.find((z) => z.zone === zone)?.level ?? 'pending';
  const nameOf = (zone: ThemeZone) => names?.[zone] ?? zoneName(t, zone);
  const label = (zone: ThemeZone) => `${nameOf(zone)}, ${levelLabel(t, levelOf(zone))}`;
  const fillOf = (zone: ThemeZone) => {
    const level = levelOf(zone);
    return level === 'pending' ? PENDING[scheme] : colors.level[level].fg;
  };
  const dim = (zone: ThemeZone) => (selected && selected !== zone ? 0.35 : 1);
  const press = (zone: ThemeZone) => (onPressZone ? () => onPressZone(zone) : undefined);
  // Skin: the silhouette edge takes the level colour only when skin needs attention.
  const skin = levelOf('skin');
  const edge = skin === 'amber' || skin === 'red' ? colors.level[skin].fg : EDGE[scheme];
  const silhouette = [FRONT_OUTLINE, ...FRONT_HEAD];

  return (
    <View className={cn('items-center gap-5', className)}>
      <View accessibilityLabel={t.bodyFigure}>
        <Svg width={width} height={height} viewBox={`${VB.x} ${VB.y} ${VB.w} ${VB.h}`}>
          {/* Base silhouette = skin and body (also its tap target). */}
          <G opacity={dim('skin')} {...svgZoneProps(press('skin'), label('skin'))}>
            {silhouette.map((d) => (
              <Path key={d.slice(0, 24)} d={d} fill={BASE[scheme]} />
            ))}
            {silhouette.map((d) => (
              <Path
                key={`e${d.slice(0, 24)}`}
                d={d}
                fill="none"
                stroke={edge}
                strokeWidth={gap}
                strokeLinejoin="round"
              />
            ))}
          </G>
          {ORGANS.map((o) => (
            <Path
              key={o.zone}
              d={o.d}
              fill={fillOf(o.zone)}
              opacity={dim(o.zone)}
              stroke={o.zone === 'heart' ? colors.background : undefined}
              strokeWidth={o.zone === 'heart' ? gap : 0}
              strokeLinejoin="round"
            />
          ))}
          {HITS.map((h) => (
            <G key={h.zone} {...svgZoneProps(press(h.zone), label(h.zone))}>
              <Polygon points={h.points} fill="transparent" />
            </G>
          ))}
        </Svg>
      </View>

      {showLegend ? (
        <BodyLegend
          zones={ZONES.map((zone) => ({
            zone,
            level: levelOf(zone),
            name: nameOf(zone),
            detail: details?.[zone],
          }))}
          selected={selected}
          onPressZone={onPressZone}
        />
      ) : null}
    </View>
  );
}

type LegendProps = {
  zones: { zone: ThemeZone; level: Level; name: string; detail?: string }[];
  selected?: string;
  onPressZone?: (zone: ThemeZone) => void;
  /** Sort worst first (red, amber, pending, green). Default false: body order. */
  sortBySeverity?: boolean;
};

/**
 * The zone list (DESIGN_SYSTEM.md §4.1a): one 56 pt row per zone inside a grouped card —
 * zone icon, name, optional grey summary, level badge and chevron.
 */
export function BodyLegend({ zones, selected, onPressZone, sortBySeverity = false }: LegendProps) {
  const t = useTexts(havenTexts);
  const rows = sortBySeverity
    ? [...zones].sort((a, b) => SEVERITY[b.level] - SEVERITY[a.level])
    : zones;
  return (
    <View className="border-border w-full overflow-hidden rounded-lg border">
      {rows.map(({ zone, level, name, detail }, i) => (
        <Button
          key={zone}
          variant="ghost"
          role={onPressZone ? 'button' : undefined}
          disabled={!onPressZone}
          onPress={onPressZone ? () => onPressZone(zone) : undefined}
          accessibilityRole={onPressZone ? 'button' : 'text'}
          accessibilityLabel={`${name}: ${levelLabel(t, level)}${detail ? `. ${detail}` : ''}`}
          accessibilityState={{ selected: selected === zone, expanded: selected === zone }}
          className={cn(
            'min-h-row h-auto justify-start gap-3 rounded-none px-4 py-2 sm:h-auto',
            Platform.select({ web: 'has-[>svg]:px-4' }),
            !onPressZone && 'opacity-100',
            selected === zone && 'bg-active',
          )}
        >
          {/* Rows keep their own type styles, not the button's text defaults. */}
          <TextClassContext.Provider value={undefined}>
            <Icon
              as={zoneIcon(zone)}
              size={20}
              strokeWidth={1.75}
              className="text-muted-foreground"
            />
            <View
              className={cn(
                'min-h-row flex-1 flex-row items-center gap-3 py-2',
                i > 0 && 'border-border -my-2 border-t pr-0',
              )}
            >
              <View className="flex-1 gap-0.5">
                <Text className="text-body-sm font-medium">{name}</Text>
                {detail ? (
                  <Text className={cn('text-caption', LEVEL_TEXT_CLASS[level])}>{detail}</Text>
                ) : null}
              </View>
              <LevelMeter level={level} />
              {onPressZone ? <Icon as={ChevronRight} size={16} className="text-tertiary" /> : null}
            </View>
          </TextClassContext.Provider>
        </Button>
      ))}
    </View>
  );
}
