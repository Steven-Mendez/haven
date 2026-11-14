import { Loader2 } from 'lucide-react-native';
import Animated from 'react-native-reanimated';

import { Icon } from '@/shared/components/ui/icon';
import { cn } from '@/shared/lib/utils';

/** Rotation keyframes for a CSS animation (Reanimated 4), the native twin of Tailwind's `animate-spin`. */
const SPIN = { to: { transform: [{ rotate: '360deg' }] } };

/**
 * shadcn/ui `Spinner` for React Native: lucide `Loader2` turning once per second. Inherits the text
 * colour of its parent (`TextClassContext`, e.g. inside a `Button`) unless `className` sets one.
 */
function Spinner({
  className,
  size = 16,
  accessibilityLabel = 'Loading',
}: {
  className?: string;
  size?: number;
  accessibilityLabel?: string;
}) {
  return (
    <Animated.View
      role="progressbar"
      accessibilityLabel={accessibilityLabel}
      style={{
        animationName: SPIN,
        animationDuration: '1s',
        animationIterationCount: 'infinite',
        animationTimingFunction: 'linear',
      }}
    >
      <Icon as={Loader2} size={size} className={cn(className)} />
    </Animated.View>
  );
}

export { Spinner };
