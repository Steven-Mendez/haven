import { Check } from 'lucide-react-native';
import { useEffect, useRef, useState } from 'react';
import { AccessibilityInfo, Animated, Easing, View } from 'react-native';
import { useReducedMotion } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Icon } from '@/shared/components/ui/icon';
import { Text } from '@/shared/components/ui/text';
import { MOTION } from '@/shared/lib/theme';

type Toast = { id: number; message: string; icon?: boolean };

let next = 1;
const listeners = new Set<(toast: Toast) => void>();

export function showToast(message: string, options: { icon?: boolean } = {}) {
  const toast = { id: next++, message, icon: options.icon ?? true };
  for (const listener of listeners) listener(toast);
}

const VISIBLE_MS = 2400;

export function ToastHost() {
  const insets = useSafeAreaInsets();
  const reduce = useReducedMotion();
  const [toast, setToast] = useState<Toast | null>(null);
  const anim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const listener = (t: Toast) => setToast(t);
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  }, []);

  useEffect(() => {
    if (!toast) return;
    AccessibilityInfo.announceForAccessibility(toast.message);
    anim.setValue(0);
    Animated.timing(anim, {
      toValue: 1,
      duration: MOTION.enter,
      easing: Easing.bezier(0.16, 1, 0.3, 1),
      useNativeDriver: true,
    }).start();
    const hide = setTimeout(() => {
      Animated.timing(anim, {
        toValue: 0,
        duration: MOTION.standard,
        useNativeDriver: true,
      }).start(() => setToast((current) => (current?.id === toast.id ? null : current)));
    }, VISIBLE_MS);
    return () => clearTimeout(hide);
  }, [toast, anim]);

  if (!toast) return null;
  return (
    <View
      pointerEvents="none"
      className="absolute right-0 left-0 items-center px-4"
      style={{ top: insets.top + 8 }}
    >
      <Animated.View
        accessibilityLiveRegion="polite"
        className="bg-elevated border-border flex-row items-center gap-2 rounded-lg border px-4 py-3"
        style={{
          opacity: anim,
          transform: reduce
            ? []
            : [{ translateY: anim.interpolate({ inputRange: [0, 1], outputRange: [-4, 0] }) }],
        }}
      >
        {toast.icon ? <Icon as={Check} size={16} strokeWidth={2} className="text-brand" /> : null}
        <Text className="text-body-sm font-medium">{toast.message}</Text>
      </Animated.View>
    </View>
  );
}
