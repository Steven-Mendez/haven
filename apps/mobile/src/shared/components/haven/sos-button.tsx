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
  onPress: () => void;
  onHoldComplete?: () => void;
  onHoldCancel?: () => void;
  className?: string;
};

const SIZE = 44;
const STROKE = 2;
const TAP_MS = 350;

const tick = () => {
  if (Platform.OS !== 'web') void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
};

export function SosButton({ onPress, onHoldComplete, onHoldCancel, className }: Props) {
  const t = useTexts(havenTexts);
  const colors = useColors();
  const reduce = useReducedMotion();
  const [progress, setProgress] = useState(0);
  const frame = useRef<number | null>(null);
  const start = useRef(0);
  const ticks = useRef(0);
  const holding = useRef(false);
  const fired = useRef(false);

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
    if (seconds > ticks.current && elapsed < MOTION.hold) {
      ticks.current = seconds;
      tick();
    }
    if (elapsed >= MOTION.hold) {
      setProgress(1);
      holding.current = false;
      fired.current = true;
      frame.current = null;
      if (Platform.OS !== 'web')
        void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      (onHoldComplete ?? onPress)();
      setTimeout(() => {
        fired.current = false;
        setProgress(0);
      }, 600);
      return;
    }
    setProgress(reduce ? Math.floor(elapsed / 1000) / 3 : elapsed / MOTION.hold);
    frame.current = requestAnimationFrame(loop);
  };

  const rewind = (from: number) => {
    const began = Date.now();
    const step = () => {
      const k = Math.min(1, (Date.now() - began) / MOTION.standard);
      setProgress(from * (1 - k));
      if (k < 1) frame.current = requestAnimationFrame(step);
      else frame.current = null;
    };
    frame.current = requestAnimationFrame(step);
  };

  const onPressIn = () => {
    if (fired.current) return;
    stop();
    holding.current = true;
    start.current = Date.now();
    ticks.current = 0;
    frame.current = requestAnimationFrame(loop);
  };
  const onPressOut = () => {
    if (!holding.current || fired.current) return;
    holding.current = false;
    stop();
    const elapsed = Date.now() - start.current;
    if (elapsed < TAP_MS) {
      setProgress(0);
      onPress();
    } else {
      rewind(progress);
      onHoldCancel?.();
    }
  };

  const r = (SIZE - STROKE) / 2;
  const c = SIZE / 2;
  const circumference = 2 * Math.PI * r;
  const red = colors.level.red.fg;

  return (
    <Button
      variant="ghost"
      accessibilityRole="button"
      accessibilityLabel={t.sosLabel}
      accessibilityHint={t.sosHint}
      accessibilityActions={[{ name: 'activate' }]}
      onAccessibilityAction={(e) => {
        if (e.nativeEvent.actionName === 'activate') onPress();
      }}
      onPressIn={onPressIn}
      onPressOut={onPressOut}
      hitSlop={4}
      className={cn(
        'h-auto gap-0 rounded-none p-0 active:bg-transparent sm:h-auto',
        Platform.select({ web: 'has-[>svg]:px-0' }),
        className,
      )}
      style={{ width: SIZE, height: SIZE }}
    >
      <View
        className="bg-elevated absolute rounded-full"
        style={{ width: SIZE - 2, height: SIZE - 2 }}
      />
      <Svg width={SIZE} height={SIZE} style={{ position: 'absolute' }}>
        <Circle
          cx={c}
          cy={c}
          r={r - 0.25}
          stroke={red}
          strokeOpacity={0.6}
          strokeWidth={1.5}
          fill="none"
        />
        {progress > 0 ? (
          <Circle
            cx={c}
            cy={c}
            r={r}
            stroke={red}
            strokeWidth={STROKE + 1}
            fill="none"
            strokeLinecap="round"
            strokeDasharray={`${circumference} ${circumference}`}
            strokeDashoffset={circumference * (1 - progress)}
            transform={`rotate(-90 ${c} ${c})`}
          />
        ) : null}
      </Svg>
      <Text
        className="text-level-red group-active:text-level-red text-[11px] leading-[13px] font-bold"
        style={{ letterSpacing: 0.4 }}
      >
        {t.sos}
      </Text>
    </Button>
  );
}
