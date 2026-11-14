import { Flame } from 'lucide-react-native';
import { type ReactNode, useEffect, useRef, useState } from 'react';
import { Animated, Easing, View } from 'react-native';
import { useReducedMotion } from 'react-native-reanimated';
import { G, Path, Svg } from 'react-native-svg';

import { Icon } from '@/shared/components/ui/icon';
import { Text } from '@/shared/components/ui/text';
import {
  RING_TRACK_OPACITY,
  RINGS,
  type RingId,
  useColors,
  useRingColor,
} from '@/shared/lib/theme';
import { cn } from '@/shared/lib/utils';

import { arcPath } from './geometry';

export type RingDatum = { id: RingId; done: number; total: number; label?: string };

type Props = {
  rings: RingDatum[];
  size?: number;
  children?: ReactNode;
  animate?: boolean;
  accessibilityLabel?: string;
  className?: string;
};

const SEGMENTED_FROM = 32;

const gapDeg = (pt: number, r: number) => (pt / r) * (180 / Math.PI);

export function ActivityRings({
  rings,
  size = 200,
  children,
  animate = true,
  accessibilityLabel,
  className,
}: Props) {
  const colors = useColors();
  const reduce = useReducedMotion();
  const scheme = colors.background === '#000000' ? 'dark' : 'light';
  const trackOpacity = RING_TRACK_OPACITY[scheme];
  const [k, setK] = useState(animate && !reduce ? 0 : 1);
  const anim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (!animate || reduce) {
      setK(1);
      return;
    }
    const id = anim.addListener(({ value }) => setK(value));
    Animated.timing(anim, {
      toValue: 1,
      duration: 600,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: false,
    }).start();
    return () => anim.removeListener(id);
  }, [animate, reduce, anim]);

  const stroke = Math.max(2.5, size * (size >= 120 ? 0.1 : 0.12));
  const c = size / 2;
  const r = c - stroke / 2;
  const span = 360 / Math.max(1, rings.length);
  const sectorGap = rings.length > 1 ? gapDeg(Math.max(2, size * 0.05), r) : 0;
  const segmentGap = gapDeg(Math.max(1, size * 0.018), r);

  return (
    <View
      accessible
      accessibilityRole="image"
      accessibilityLabel={accessibilityLabel}
      className={cn('items-center justify-center', className)}
      style={{ width: size, height: size }}
    >
      <Svg width={size} height={size} style={{ position: 'absolute' }}>
        {rings.map((ring, i) => {
          const color = RINGS[ring.id][scheme];
          const start = i * span + sectorGap / 2;
          const end = (i + 1) * span - sectorGap / 2;
          const total = Math.max(0, ring.total);
          const done = Math.min(Math.max(0, ring.done), total) * k;
          const step = total > 0 ? (end - start) / total : 0;

          if (size < SEGMENTED_FROM || total <= 1 || step < segmentGap * 2.5) {
            const to = total > 0 ? start + ((end - start) * done) / total : start;
            return (
              <G key={ring.id}>
                <Path
                  d={arcPath(c, c, r, start, end)}
                  stroke={color}
                  strokeOpacity={trackOpacity}
                  strokeWidth={stroke}
                  fill="none"
                />
                {to > start ? (
                  <Path
                    d={arcPath(c, c, r, start, to)}
                    stroke={color}
                    strokeWidth={stroke}
                    fill="none"
                  />
                ) : null}
              </G>
            );
          }

          return (
            <G key={ring.id}>
              {Array.from({ length: total }, (_, s) => (
                <Path
                  // biome-ignore lint/suspicious/noArrayIndexKey: one fixed segment per action
                  key={s}
                  d={arcPath(
                    c,
                    c,
                    r,
                    start + s * step + segmentGap / 2,
                    start + (s + 1) * step - segmentGap / 2,
                  )}
                  stroke={color}
                  strokeOpacity={s < done ? 1 : trackOpacity}
                  strokeWidth={stroke}
                  fill="none"
                />
              ))}
            </G>
          );
        })}
      </Svg>
      {children}
    </View>
  );
}

export function RingLegend({ rings, className }: { rings: RingDatum[]; className?: string }) {
  const colors = useColors();
  const scheme = colors.background === '#000000' ? 'dark' : 'light';
  return (
    <View className={cn('gap-2', className)}>
      {rings.map((ring) => (
        <View key={ring.id} className="flex-row items-center gap-2">
          <View
            className="h-2.5 w-2.5 rounded-full"
            style={{ backgroundColor: RINGS[ring.id][scheme] }}
          />
          <Text className="text-body-sm text-muted-foreground flex-1" numberOfLines={1}>
            {ring.label}
          </Text>
          <Text
            className="text-body-sm font-semibold tabular-nums"
            style={{ color: RINGS[ring.id][scheme] }}
          >
            {`${ring.done}/${ring.total}`}
          </Text>
        </View>
      ))}
    </View>
  );
}

export function RingSpark({ size, strokeWidth = 1.75 }: { size: number; strokeWidth?: number }) {
  return <Icon as={Flame} size={size} strokeWidth={strokeWidth} color={useRingColor('routine')} />;
}
