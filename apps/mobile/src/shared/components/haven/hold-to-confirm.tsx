import * as Haptics from 'expo-haptics';
import { useEffect, useRef, useState } from 'react';
import { Platform, View } from 'react-native';
import { useReducedMotion } from 'react-native-reanimated';
import { Circle, Svg } from 'react-native-svg';

import { Button } from '@/shared/components/ui/button';
import { Text } from '@/shared/components/ui/text';
import { useTexts } from '@/shared/i18n';
import { MOTION, useColors } from '@/shared/lib/theme';
import { cn } from '@/shared/lib/utils';

import { havenTexts } from './i18n';

type Props = {
  onConfirm: () => void;
  label: string;
  hint?: string;
  accessibilityLabel: string;
  duration?: number;
  size?: number;
  className?: string;
};

const tick = () => {
  if (Platform.OS !== 'web') void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
};

export function HoldToConfirm({
  onConfirm,
  label,
  hint,
  accessibilityLabel,
  duration = MOTION.hold,
  size = 200,
  className,
}: Props) {
  const t = useTexts(havenTexts);
  const colors = useColors();
  const reduce = useReducedMotion();
  const [progress, setProgress] = useState(0);
  const [holding, setHolding] = useState(false);
  const frame = useRef<number | null>(null);
  const start = useRef(0);
  const ticks = useRef(0);
  const fired = useRef(false);
  const confirm = useRef(onConfirm);
  confirm.current = onConfirm;

  const stop = () => {
    if (frame.current !== null) cancelAnimationFrame(frame.current);
    frame.current = null;
  };
  useEffect(
    () => () => {
      if (frame.current !== null) cancelAnimationFrame(frame.current);
    },
    [],
  );

  const loop = () => {
    const elapsed = Date.now() - start.current;
    const seconds = Math.floor(elapsed / 1000);
    if (seconds > ticks.current && elapsed < duration) {
      ticks.current = seconds;
      tick();
    }
    if (elapsed >= duration) {
      setProgress(1);
      setHolding(false);
      frame.current = null;
      if (!fired.current) {
        fired.current = true;
        if (Platform.OS !== 'web')
          void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        confirm.current();
      }
      return;
    }
    setProgress(reduce ? Math.floor(elapsed / 1000) / (duration / 1000) : elapsed / duration);
    frame.current = requestAnimationFrame(loop);
  };

  const onPressIn = () => {
    if (fired.current) return;
    start.current = Date.now();
    ticks.current = 0;
    setHolding(true);
    tick();
    stop();
    frame.current = requestAnimationFrame(loop);
  };
  const onPressOut = () => {
    if (fired.current) return;
    stop();
    setHolding(false);
    setProgress(0);
  };

  const stroke = 8;
  const r = (size - stroke) / 2;
  const circumference = 2 * Math.PI * r;
  const remaining = Math.max(1, Math.ceil((duration * (1 - progress)) / 1000));
  const inner = size - stroke * 2 - 24;

  return (
    <View className={cn('items-center gap-5', className)}>
      <Button
        variant="ghost"
        accessibilityRole="button"
        accessibilityLabel={accessibilityLabel}
        accessibilityHint={t.holdHint}
        accessibilityActions={[{ name: 'activate' }]}
        onAccessibilityAction={(e) => {
          if (e.nativeEvent.actionName === 'activate' && !fired.current) {
            fired.current = true;
            confirm.current();
          }
        }}
        onPressIn={onPressIn}
        onPressOut={onPressOut}
        style={{ width: size, height: size }}
        className={cn(
          'h-auto gap-0 rounded-none p-0 active:bg-transparent sm:h-auto',
          Platform.select({ web: 'has-[>svg]:px-0' }),
        )}
      >
        <Svg width={size} height={size} style={{ position: 'absolute' }}>
          <Circle
            cx={size / 2}
            cy={size / 2}
            r={r}
            stroke={colors.muted}
            strokeWidth={stroke}
            fill="none"
          />
          {progress > 0 ? (
            <Circle
              cx={size / 2}
              cy={size / 2}
              r={r}
              stroke={colors.destructive}
              strokeWidth={stroke}
              fill="none"
              strokeDasharray={`${circumference} ${circumference}`}
              strokeDashoffset={circumference * (1 - progress)}
              strokeLinecap="round"
              transform={`rotate(-90 ${size / 2} ${size / 2})`}
            />
          ) : null}
        </Svg>
        <View
          className={cn(
            'items-center justify-center rounded-full',
            holding ? 'bg-transparent' : 'bg-destructive',
          )}
          style={{ width: inner, height: inner }}
        >
          {holding ? (
            <Text
              className="text-foreground font-semibold tabular-nums"
              style={{ fontSize: 72, lineHeight: 80 }}
              accessibilityLiveRegion="polite"
            >
              {remaining}
            </Text>
          ) : (
            <Text className="text-destructive-foreground group-active:text-destructive-foreground text-display font-bold">
              {label}
            </Text>
          )}
        </View>
      </Button>
      <Text className="text-muted-foreground text-body-sm text-center">
        {holding ? t.holdRelease : (hint ?? t.holdToStart)}
      </Text>
    </View>
  );
}
