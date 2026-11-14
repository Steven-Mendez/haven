import type { Level } from '@haven/core';
import { View } from 'react-native';
import { Circle, Path, Rect, Svg } from 'react-native-svg';

import { Text } from '@/shared/components/ui/text';
import { useColors } from '@/shared/lib/theme';
import { cn } from '@/shared/lib/utils';

import { monotonePath } from './logic/monotone';

type SparklineProps = {
  data: [number, number][];
  level?: Level;
  width?: number;
  height?: number;
  className?: string;
};

export function Sparkline({ data, level, width = 56, height = 20, className }: SparklineProps) {
  const colors = useColors();
  const pts = [...data].filter(([, v]) => Number.isFinite(v)).sort((a, b) => a[0] - b[0]);
  if (pts.length < 2) return <View style={{ width, height }} className={className} aria-hidden />;
  const t0 = pts[0][0];
  const t1 = pts[pts.length - 1][0];
  const vs = pts.map(([, v]) => v);
  let lo = Math.min(...vs);
  let hi = Math.max(...vs);
  if (hi - lo < 1e-6) {
    lo -= 1;
    hi += 1;
  }
  const pad = 3;
  const xy = pts.map(
    ([t, v]) =>
      [
        pad + ((t - t0) / Math.max(t1 - t0, 1)) * (width - pad * 2),
        pad + (1 - (v - lo) / (hi - lo)) * (height - pad * 2),
      ] as [number, number],
  );
  const alert = level === 'amber' || level === 'red';
  const tone = alert ? colors.level[level].fg : colors.secondary;
  const [ex, ey] = xy[xy.length - 1];
  return (
    <View aria-hidden className={className}>
      <Svg width={width} height={height}>
        <Path
          d={monotonePath(xy)}
          stroke={tone}
          strokeWidth={1.25}
          fill="none"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <Circle cx={ex} cy={ey} r={2} fill={tone} />
      </Svg>
    </View>
  );
}

type Bar = { label: string; value: number; accessibilityLabel?: string };

type BarChartProps = {
  bars: Bar[];
  selected?: number;
  height?: number;
  formatValue?: (v: number) => string;
  className?: string;
};

export function BarChart({
  bars,
  selected,
  height = 96,
  formatValue = (v) => String(Math.round(v)),
  className,
}: BarChartProps) {
  const colors = useColors();
  const current = selected ?? bars.length - 1;
  const max = Math.max(1, ...bars.map((b) => b.value));
  const plotH = height - 18;
  return (
    <View className={cn('gap-1', className)}>
      <View className="flex-row items-end" style={{ height: plotH }}>
        {bars.map((b, i) => {
          const h = Math.max(2, (b.value / max) * plotH);
          return (
            <View
              // biome-ignore lint/suspicious/noArrayIndexKey: fixed bars; labels repeat (weekdays)
              key={`${b.label}${i}`}
              accessible
              accessibilityLabel={b.accessibilityLabel ?? `${b.label}: ${formatValue(b.value)}`}
              className="flex-1 items-center justify-end"
            >
              <Svg width="60%" height={h}>
                <Rect
                  x={0}
                  y={0}
                  width="100%"
                  height={h + 2}
                  rx={2}
                  fill={colors.foreground}
                  fillOpacity={i === current ? 1 : 0.18}
                />
              </Svg>
            </View>
          );
        })}
      </View>
      <View className="flex-row">
        {bars.map((b, i) => (
          <Text
            // biome-ignore lint/suspicious/noArrayIndexKey: fixed bars; labels repeat (weekdays)
            key={`${b.label}l${i}`}
            className={cn(
              'flex-1 text-center text-[11px] leading-[14px]',
              i === current ? 'text-foreground font-semibold' : 'text-tertiary',
            )}
          >
            {b.label}
          </Text>
        ))}
      </View>
    </View>
  );
}
