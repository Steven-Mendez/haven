import type { Level } from '@haven/core';
import { View } from 'react-native';
import { Circle, ClipPath, Defs, G, Path, Rect, Svg } from 'react-native-svg';

import { useColors } from '@/shared/lib/theme';
import { cn } from '@/shared/lib/utils';

type ShapeProps = { level: Level; cx: number; cy: number; size: number; color: string };

/**
 * Level shape as raw SVG, to draw inside another <Svg> (BodyFigure, charts). Same shapes on phone,
 * watch and Earth (tokens.json → level.symbol): green ● filled circle · amber ◐ half-filled ring ·
 * red ▲ filled triangle · pending ○ dashed ring. Never a hollow ring that reads as a radio button.
 */
export function LevelShape({ level, cx, cy, size, color }: ShapeProps) {
  const r = size / 2;
  if (level === 'green') return <Circle cx={cx} cy={cy} r={r * 0.9} fill={color} />;
  if (level === 'amber') {
    const stroke = Math.max(1.25, size * 0.16);
    const ri = r - stroke / 2;
    const id = `half-${Math.round(cx * 10)}-${Math.round(cy * 10)}-${Math.round(size * 10)}`;
    return (
      <G>
        <Defs>
          <ClipPath id={id}>
            <Rect x={cx - r} y={cy - r} width={r} height={size} />
          </ClipPath>
        </Defs>
        <Circle cx={cx} cy={cy} r={ri} fill="none" stroke={color} strokeWidth={stroke} />
        <Circle cx={cx} cy={cy} r={ri} fill={color} clipPath={`url(#${id})`} />
      </G>
    );
  }
  if (level === 'red') {
    // Equilateral triangle, optically centred (the centroid sits a little low).
    const h = size * 0.88;
    const w = h * 1.1547;
    const top = cy - h * 0.58;
    return (
      <Path
        d={`M ${cx} ${top} L ${cx + w / 2} ${top + h} L ${cx - w / 2} ${top + h} Z`}
        fill={color}
        strokeLinejoin="round"
        stroke={color}
        strokeWidth={Math.max(0.5, size * 0.06)}
      />
    );
  }
  const stroke = Math.max(1.25, size * 0.14);
  return (
    <Circle
      cx={cx}
      cy={cy}
      r={r - stroke / 2}
      fill="none"
      stroke={color}
      strokeWidth={stroke}
      strokeDasharray={`${Math.max(1.5, size * 0.2)} ${Math.max(1.5, size * 0.16)}`}
    />
  );
}

type Props = {
  level: Level;
  /** 6 dot · 8 inline · 10 badge · 12 header (tokens.json → level.symbolSize). Other values work too. */
  size?: number;
  color?: string;
};

/** Standalone level symbol. Decorative: the label next to it carries the meaning. */
export function LevelSymbol({ level, size = 10, color }: Props) {
  const colors = useColors();
  return (
    <Svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} aria-hidden>
      <LevelShape
        level={level}
        cx={size / 2}
        cy={size / 2}
        size={size}
        color={color ?? colors.level[level].fg}
      />
    </Svg>
  );
}

/** Active segment per level (tokens.json → level.meter.activeSegment). Pending: none. */
const METER_SEGMENT: Record<Level, number> = { green: 0, amber: 1, red: 2, pending: -1 };

/**
 * WHOOP-style 3-segment level meter (tokens.json → level.meter): three 14×3 bars, only the active
 * one coloured (in range · check · emergency). Pending: three dim segments. Decorative.
 */
export function LevelMeter({ level, className }: { level: Level; className?: string }) {
  const active = METER_SEGMENT[level];
  const tone = {
    green: 'bg-level-green',
    amber: 'bg-level-amber',
    red: 'bg-level-red',
    pending: 'bg-muted',
  }[level];
  return (
    <View aria-hidden className={cn('flex-row items-center gap-0.5', className)}>
      {[0, 1, 2].map((i) => (
        <View
          key={i}
          className={cn('h-[3px] w-3.5 rounded-[1px]', i === active ? tone : 'bg-muted')}
        />
      ))}
    </View>
  );
}
