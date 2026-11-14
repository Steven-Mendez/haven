import { createContext, type ReactNode, useContext } from 'react';
import { ScrollView, type ScrollViewProps, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { cn } from '@/shared/lib/utils';

// Safe areas (EQUIPOS.md «Safe areas»): content never goes under the Dynamic Island, the status
// bar, the home indicator, the tab bar or the floating SOS. Backgrounds may reach the edges.

/**
 * Gap below the last item inside tabs. The SOS lives in the tab bar now (it no longer floats over
 * content), so only breathing room is needed.
 */
export const SOS_CLEARANCE = 24;

/** Breathing room above the home indicator at the end of a stack screen. */
const BOTTOM_GAP = 16;

const InTabsContext = createContext(false);

/** Set by the tabs layout: screens inside it sit above the tab bar, under the floating SOS. */
export function InTabsProvider({ children }: { children: ReactNode }) {
  return <InTabsContext.Provider value>{children}</InTabsContext.Provider>;
}

export type ScreenInsets = {
  /**
   * Top padding for the content: the status bar/island inset without a native header, 0 under one.
   * Native stack headers are translucent on iOS 26: a ScrollView under them needs
   * `contentInsetAdjustmentBehavior="automatic"` (what `<Screen>` does).
   */
  top: number;
  /** Bottom padding so the last item clears the home indicator (stack) or the tab bar (tabs). */
  bottom: number;
  left: number;
  right: number;
  /** Raw insets from react-native-safe-area-context. */
  raw: { top: number; bottom: number; left: number; right: number };
  inTabs: boolean;
};

/**
 * Paddings a screen needs. `header: false` for screens without a native header
 * (`headerShown: false`, full-screen tests): then `top` includes the Dynamic Island.
 */
export function useScreenInsets(options: { header?: boolean } = {}): ScreenInsets {
  const raw = useSafeAreaInsets();
  const inTabs = useContext(InTabsContext);
  const header = options.header ?? true;
  return {
    top: header ? 0 : raw.top,
    // Inside tabs the tab bar already covers the home indicator.
    bottom: inTabs ? SOS_CLEARANCE : raw.bottom + BOTTOM_GAP,
    left: raw.left,
    right: raw.right,
    raw,
    inTabs,
  };
}

type ScreenProps = {
  children: ReactNode;
  /** `false` when the screen has no native header (adds the top inset). Default `true`. */
  header?: boolean;
  /**
   * Scrollable content (default). `false` renders a plain full-height view with the same paddings;
   * use it with `header={false}` (a static view cannot know the translucent header's height).
   */
  scroll?: boolean;
  /** Fixed footer (main action: «Save», «Send», «Done»), kept above the home indicator / SOS. */
  footer?: ReactNode;
  /** Classes of the outer view (background). */
  className?: string;
  /** Classes of the content (default `gap-6`). Paddings go through `padded`, not classes. */
  contentClassName?: string;
  /** 16 pt around the content, added to the insets (default `true`; `false` for edge-to-edge lists). */
  padded?: boolean;
} & Pick<ScrollViewProps, 'refreshControl' | 'keyboardShouldPersistTaps' | 'scrollEnabled'>;

/**
 * Screen wrapper with safe areas applied: background to the edges, content inside the insets,
 * the last item above the home indicator (stack) or above the tab bar and SOS (tabs).
 */
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
  // Under a native header (translucent on iOS 26) iOS adds the header and home-indicator insets
  // itself with `contentInsetAdjustmentBehavior="automatic"`; only our own gaps are added here.
  // Inside tabs the header is ours (opaque) and the list ends above the tab bar: nothing to adjust.
  const auto = scroll && header && !insets.inTabs;
  // Inline styles override padding classes, so the base gap is added here, not with `px-4`.
  const gap = padded ? 16 : 0;
  const content = cn('gap-6', contentClassName);
  const padding = {
    paddingTop: gap + (auto ? 0 : insets.top),
    paddingLeft: gap + insets.left,
    paddingRight: gap + insets.right,
  };
  // With a footer, the footer takes the bottom inset and the content only needs a small gap.
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
