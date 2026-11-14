import { useCallback, useEffect, useRef, useState } from 'react';
import { View } from 'react-native';
import { Circle, Path, Svg } from 'react-native-svg';

import { Text } from '@/shared/components/ui/text';
import { useTexts } from '@/shared/i18n';
import { useColors } from '@/shared/lib/theme';
import { cn } from '@/shared/lib/utils';

import { arcPath, clamp01 } from './geometry';
import { format, havenTexts } from './i18n';

export function formatClock(seconds: number): string {
  const s = Math.max(0, Math.ceil(seconds));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

type Props = {
  total: number;
  remaining: number;
  size?: number;
  label?: string;
  paused?: boolean;
  color?: string;
  className?: string;
};

export function StepTimer({
  total,
  remaining,
  size = 240,
  label,
  paused = false,
  color,
  className,
}: Props) {
  const colors = useColors();
  const t = useTexts(havenTexts);
  const stroke = Math.max(6, Math.round(size / 30));
  const r = (size - stroke) / 2;
  const c = size / 2;
  const fraction = total > 0 ? clamp01(remaining / total) : 0;
  const done = remaining <= 0;
  const ring = color ?? colors.foreground;
  const clock = formatClock(remaining);
  const status = done ? t.timeUp : paused ? t.paused : label;

  return (
    <View
      accessible
      accessibilityRole="timer"
      accessibilityLabel={`${t.timer}: ${done ? t.timeUp : format(t.timeLeft, { n: clock })}${
        paused ? `, ${t.paused}` : ''
      }${label ? `, ${label}` : ''}`}
      className={cn('items-center justify-center', className)}
      style={{ width: size, height: size }}
    >
      <Svg width={size} height={size} style={{ position: 'absolute' }}>
        <Circle cx={c} cy={c} r={r} stroke={colors.muted} strokeWidth={stroke} fill="none" />
        {fraction > 0 ? (
          <Path
            d={arcPath(c, c, r, 0, 360 * fraction)}
            stroke={ring}
            strokeWidth={stroke}
            strokeLinecap="round"
            fill="none"
          />
        ) : null}
      </Svg>
      <Text
        className={cn(
          'font-medium tabular-nums',
          size >= 200 ? 'text-metric-xl' : 'text-metric',
          paused && 'text-muted-foreground',
        )}
      >
        {clock}
      </Text>
      {status ? (
        <Text className="text-muted-foreground text-footnote mt-1 text-center" numberOfLines={2}>
          {status}
        </Text>
      ) : null}
    </View>
  );
}

export function useCountdown(total: number, running: boolean, onDone?: () => void) {
  const [remaining, setRemaining] = useState(total);
  const [epoch, setEpoch] = useState(0);
  const left = useRef(total);
  const doneRef = useRef(onDone);
  doneRef.current = onDone;

  // biome-ignore lint/correctness/useExhaustiveDependencies: epoch restarts the clock after reset()
  useEffect(() => {
    if (!running || left.current <= 0) return;
    const endAt = Date.now() + left.current * 1000;
    const id = setInterval(() => {
      left.current = Math.max(0, (endAt - Date.now()) / 1000);
      setRemaining(left.current);
      if (left.current <= 0) {
        clearInterval(id);
        doneRef.current?.();
      }
    }, 250);
    return () => clearInterval(id);
  }, [running, epoch]);

  const reset = useCallback(
    (seconds: number = total) => {
      left.current = seconds;
      setRemaining(seconds);
      setEpoch((e) => e + 1);
    },
    [total],
  );
  return { remaining, reset, done: remaining <= 0 };
}
