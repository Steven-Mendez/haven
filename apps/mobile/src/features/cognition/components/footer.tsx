import type { ReactNode } from 'react';
import { View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

/**
 * Fixed footer for the screen's main action (DESIGN_SYSTEM.md 8.12): above the home indicator
 * (`insets.bottom + 16`), background to the edge, content inside the safe area.
 */
export function Footer({ children }: { children: ReactNode }) {
  const insets = useSafeAreaInsets();
  return (
    <View
      className="bg-background border-border gap-2 border-t px-4 pt-3"
      style={{ paddingBottom: insets.bottom + 16 }}
    >
      {children}
    </View>
  );
}
