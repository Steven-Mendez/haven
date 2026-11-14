import { createContext, type ReactNode, useContext } from 'react';
import { ScrollView, type ScrollViewProps, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { cn } from '@/shared/lib/utils';

export const SOS_CLEARANCE = 24;

const BOTTOM_GAP = 16;

const InTabsContext = createContext(false);

export function InTabsProvider({ children }: { children: ReactNode }) {
  return <InTabsContext.Provider value>{children}</InTabsContext.Provider>;
}

export type ScreenInsets = {
  top: number;
  bottom: number;
  left: number;
  right: number;
  raw: { top: number; bottom: number; left: number; right: number };
  inTabs: boolean;
};

export function useScreenInsets(options: { header?: boolean } = {}): ScreenInsets {
  const raw = useSafeAreaInsets();
  const inTabs = useContext(InTabsContext);
  const header = options.header ?? true;
  return {
    top: header ? 0 : raw.top,
    bottom: inTabs ? SOS_CLEARANCE : raw.bottom + BOTTOM_GAP,
    left: raw.left,
    right: raw.right,
    raw,
    inTabs,
  };
}

type ScreenProps = {
  children: ReactNode;
  header?: boolean;
  scroll?: boolean;
  footer?: ReactNode;
  className?: string;
  contentClassName?: string;
  padded?: boolean;
} & Pick<ScrollViewProps, 'refreshControl' | 'keyboardShouldPersistTaps' | 'scrollEnabled'>;

export function Screen({
  children,
  header = true,
  scroll = true,
  footer,
  padded = true,
  className,
  contentClassName,
  ...scrollProps
}: ScreenProps) {
  const insets = useScreenInsets({ header });
  const auto = scroll && header && !insets.inTabs;
  const gap = padded ? 16 : 0;
  const content = cn('gap-6', contentClassName);
  const padding = {
    paddingTop: gap + (auto ? 0 : insets.top),
    paddingLeft: gap + insets.left,
    paddingRight: gap + insets.right,
  };
  const contentBottom = footer || (auto && !insets.inTabs) ? BOTTOM_GAP : insets.bottom;

  return (
    <View className={cn('bg-background flex-1', className)}>
      {scroll ? (
        <ScrollView
          className="flex-1"
          contentContainerClassName={content}
          contentContainerStyle={{ ...padding, paddingBottom: contentBottom }}
          contentInsetAdjustmentBehavior={auto ? 'automatic' : 'never'}
          keyboardShouldPersistTaps="handled"
          {...scrollProps}
        >
          {children}
        </ScrollView>
      ) : (
        <View
          className={cn('flex-1', content)}
          style={{ ...padding, paddingBottom: contentBottom }}
        >
          {children}
        </View>
      )}
      {footer ? (
        <View
          className="border-border bg-background border-t px-4 pt-3"
          style={{
            paddingBottom: insets.bottom,
            paddingLeft: 16 + insets.left,
            paddingRight: 16 + insets.right,
          }}
        >
          {footer}
        </View>
      ) : null}
    </View>
  );
}
