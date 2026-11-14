import { Loader2 } from 'lucide-react-native';
import Animated from 'react-native-reanimated';

import { Icon } from '@/shared/components/ui/icon';
import { cn } from '@/shared/lib/utils';

const SPIN = { to: { transform: [{ rotate: '360deg' }] } };

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
