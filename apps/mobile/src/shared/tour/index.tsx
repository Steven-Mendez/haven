// First-run tour (the mobile counterpart of driver.js on Earth), on react-native-spotlight-tour.
// It walks the essential screens: Body (status, alerts, first steps or next action, zones), Routine
// (how you feel, today's actions), Trends (indicators), Mission (link with Earth), then the SOS and the
// profile back on Body. Before each step it opens the step's tab, waits for the element and scrolls it
// into view. Body steps that depend on data (alerts, first steps, next action) only run when shown.
// The provider sits in the tabs layout, so it can point at any tab and at the tab bar's SOS.
// Seen once per install (kv-store); Settings › «Show the tour» runs it again.

import { router } from 'expo-router';
import Storage from 'expo-sqlite/kv-store';
import { X } from 'lucide-react-native';
import {
  createContext,
  type ReactNode,
  type RefObject,
  useContext,
  useEffect,
  useRef,
  useSyncExternalStore,
} from 'react';
import type {
  NativeScrollEvent,
  NativeSyntheticEvent,
  ScrollViewInstance,
  ViewInstance,
} from 'react-native';
import { useWindowDimensions, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  AttachStep,
  type RenderProps,
  SpotlightTourProvider,
  type TourStep,
  useSpotlightTour,
} from 'react-native-spotlight-tour';

import { format } from '@/shared/components/haven';
import { Button } from '@/shared/components/ui/button';
import { Icon } from '@/shared/components/ui/icon';
import { Text } from '@/shared/components/ui/text';
import { useTexts } from '@/shared/i18n';
import { useColors } from '@/shared/lib/theme';
import { cn } from '@/shared/lib/utils';
import { tourTexts } from './i18n';

/** Every step, in tour order. */
const ORDER = [
  'verdict',
  'alerts',
  'start',
  'next',
  'figure',
  'routine-checkin',
  'routine-today',
  'trends-list',
  'mission-link',
  'sos',
  'profile',
] as const;
export type TourStepName = (typeof ORDER)[number];

/** Tabs the tour opens. */
export type TourScreen = 'body' | 'routine' | 'trends' | 'mission';
const PATH: Record<TourScreen, '/' | '/routine' | '/trends' | '/mission'> = {
  body: '/',
  routine: '/routine',
  trends: '/trends',
  mission: '/mission',
};

/** The tab each step lives on (the SOS is in the tab bar: no tab). */
const SCREEN: Partial<Record<TourStepName, TourScreen>> = {
  verdict: 'body',
  alerts: 'body',
  start: 'body',
  next: 'body',
  figure: 'body',
  'routine-today': 'routine',
  'routine-checkin': 'routine',
  'trends-list': 'trends',
  'mission-link': 'mission',
  profile: 'body',
};

/** Body steps that only exist with some data: they run only when Body shows them. */
const OPTIONAL = new Set<TourStepName>(['alerts', 'start', 'next']);
/** Round targets get a round spotlight and ring. */
const ROUND = new Set<TourStepName>(['sos', 'profile']);
/** Targets inside a clipped card (overflow hidden): the ring goes inside their edges. */
const INSIDE = new Set<TourStepName>(['next', 'mission-link']);

type TextKey = keyof (typeof tourTexts)['en'];
const COPY: Record<TourStepName, { title: TextKey; body: TextKey }> = {
  verdict: { title: 'verdictTitle', body: 'verdictBody' },
  alerts: { title: 'alertsTitle', body: 'alertsBody' },
  start: { title: 'startTitle', body: 'startBody' },
  next: { title: 'nextTitle', body: 'nextBody' },
  figure: { title: 'figureTitle', body: 'figureBody' },
  'routine-today': { title: 'todayTitle', body: 'todayBody' },
  'routine-checkin': { title: 'checkinTitle', body: 'checkinBody' },
  'trends-list': { title: 'trendsTitle', body: 'trendsBody' },
  'mission-link': { title: 'missionTitle', body: 'missionBody' },
  sos: { title: 'sosTitle', body: 'sosBody' },
  profile: { title: 'profileTitle', body: 'profileBody' },
};

// v4: the steps changed, so the tour shows once more to everyone who saw an earlier one.
const KEY = 'haven.tour.v4';

function seen(): boolean {
  try {
    return Storage.getItemSync(KEY) === '1';
  } catch {
    return false;
  }
}

function markSeen() {
  try {
    Storage.setItemSync(KEY, '1');
  } catch {
    // Not persisted: the tour shows again next launch, which is harmless.
  }
}

// Mounted anchors (name → view). Tabs mount on first visit, so only the optional Body steps
// depend on this; the rest always run.
const anchors = new Map<TourStepName, ViewInstance>();
const anchorListeners = new Set<() => void>();
let steps: TourStepName[] = ORDER.filter((s) => !OPTIONAL.has(s));

function updateSteps() {
  const next = ORDER.filter((s) => !OPTIONAL.has(s) || anchors.has(s));
  if (next.join() === steps.join()) return;
  steps = next;
  for (const l of anchorListeners) l();
}

function useSteps(): TourStepName[] {
  return useSyncExternalStore(
    (fn) => {
      anchorListeners.add(fn);
      return () => anchorListeners.delete(fn);
    },
    () => steps,
    () => steps,
  );
}

export type WindowRect = { x: number; y: number; width: number; height: number };

/** Brings a target on screen in a tab's scroll view. Resolves once it has settled. */
type Scroller = (rect: WindowRect) => Promise<void>;
const scrollers = new Map<TourScreen, Scroller>();

const wait = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

/**
 * Lets the tour scroll a tab: pass the tab's ScrollView ref, and put the returned handler on its
 * `onScroll` (with `scrollEventThrottle`). Targets are brought under the top inset with room for the
 * popover below.
 */
export function useTourScroll(
  screen: TourScreen,
  scroll: RefObject<ScrollViewInstance | null>,
): (e: NativeSyntheticEvent<NativeScrollEvent>) => void {
  const offset = useRef(0);
  const insets = useSafeAreaInsets();
  const { height } = useWindowDimensions();
  useEffect(() => {
    const fn: Scroller = async (rect) => {
      const top = insets.top + 24;
      // Tab bar (~90 pt) and the popover (~240 pt) below the target.
      const bottom = height - 90 - 240;
      if (rect.y >= top && rect.y + rect.height <= bottom) return;
      scroll.current?.scrollTo({
        y: Math.max(0, offset.current + rect.y - (top + 32)),
        animated: true,
      });
      await wait(400);
    };
    scrollers.set(screen, fn);
    return () => {
      if (scrollers.get(screen) === fn) scrollers.delete(screen);
    };
  }, [screen, scroll, insets.top, height]);
  return (e) => {
    offset.current = e.nativeEvent.contentOffset.y;
  };
}

function measure(view: ViewInstance): Promise<WindowRect> {
  return new Promise((resolve) =>
    view.measureInWindow((x, y, width, height) => resolve({ x, y, width, height })),
  );
}

let onScreen: TourScreen = 'body';

/** Opens the step's tab, waits for its element to mount and lay out, then scrolls it into view. */
async function bringIntoView(step: TourStepName) {
  const screen = SCREEN[step];
  if (screen && screen !== onScreen) {
    router.navigate(PATH[screen]);
    onScreen = screen;
    // A tab mounts on its first visit: wait for the element (at most ~2 s).
    for (let i = 0; i < 20 && !anchors.has(step); i++) await wait(100);
    await wait(250);
  }
  const view = anchors.get(step);
  const scroller = screen ? scrollers.get(screen) : undefined;
  if (view && scroller) await scroller(await measure(view));
}

let requested = false;
const requestListeners = new Set<() => void>();

/** Settings › «Show the tour»: runs it again the next time Body is on screen. */
export function requestTour() {
  requested = true;
  for (const l of requestListeners) l();
}

/**
 * One step's popover (My BMW / monday.com on Mobbin): title and ✕, one or two short lines that say
 * what to do, then «2 of 5» · Back · Next (Done on the last).
 */
function Popover({ step, total, ...p }: RenderProps & { step: TourStepName; total: number }) {
  const t = useTexts(tourTexts);
  const { width } = useWindowDimensions();
  const copy = COPY[step];
  return (
    <View
      accessibilityViewIsModal
      accessibilityLiveRegion="polite"
      className="bg-elevated border-border gap-3 rounded-lg border p-4"
      style={{ width: Math.min(340, width - 32) }}
    >
      <View className="gap-1">
        <View className="flex-row items-start gap-2">
          <Text role="heading" className="text-body flex-1 font-semibold">
            {t[copy.title]}
          </Text>
          <Button
            variant="ghost"
            size="icon"
            accessibilityLabel={t.close}
            hitSlop={10}
            onPress={p.stop}
            className="-mt-1 -mr-2 h-7 w-7 sm:h-7 sm:w-7"
          >
            <Icon as={X} size={16} className="text-muted-foreground" />
          </Button>
        </View>
        <Text className="text-muted-foreground text-body-sm">{t[copy.body]}</Text>
      </View>
      <View className="flex-row items-center gap-2">
        <Text className="text-tertiary text-caption flex-1 tabular-nums">
          {format(t.step, { n: p.current + 1, total })}
        </Text>
        {p.isFirst ? null : (
          <Button variant="ghost" size="sm" onPress={p.previous}>
            <Text>{t.back}</Text>
          </Button>
        )}
        <Button size="sm" onPress={p.next}>
          <Text>{p.isLast ? t.done : t.next}</Text>
        </Button>
      </View>
    </View>
  );
}

function stepOf(step: TourStepName, total: number): TourStep {
  return {
    before: () => bringIntoView(step),
    render: (props: RenderProps) => <Popover step={step} total={total} {...props} />,
    shape: ROUND.has(step) ? { type: 'circle', padding: 8 } : { type: 'rectangle', padding: 10 },
    placement: SCREEN[step] ? 'bottom' : 'top',
  };
}

/** The steps on screen, for the anchors' indexes. */
const StepsContext = createContext<TourStepName[]>([]);

/** Wraps the tabs: the overlay can spotlight Body and the tab bar. */
export function TourProvider({ children }: { children: ReactNode }) {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  // The popover stays inside the safe areas (Dynamic Island, home indicator) and off the edges.
  // Next to a tall target with no room above or below, it slides over the target instead.
  const safe = {
    top: insets.top + 8,
    bottom: insets.bottom + 8,
    left: insets.left + 16,
    right: insets.right + 16,
  };
  const steps = useSteps();
  return (
    <StepsContext.Provider value={steps}>
      <SpotlightTourProvider
        steps={steps.map((s) => stepOf(s, steps.length))}
        overlayColor="#000"
        overlayOpacity={0.8}
        motion="fade"
        nativeDriver
        onStop={() => {
          markSeen();
          // Back to Body when the tour ends elsewhere.
          if (onScreen !== 'body') router.navigate(PATH.body);
          onScreen = 'body';
        }}
        arrow={{ color: colors.elevated, size: 14 }}
        offset={14}
        flip={{ padding: safe }}
        shift={{ padding: safe, crossAxis: true }}
      >
        {children}
      </SpotlightTourProvider>
    </StepsContext.Provider>
  );
}

/**
 * Marks `children` as the target of a step. While its step runs it draws a brand ring around it, so
 * it is clear what the popover talks about.
 */
export function TourAnchor({
  step,
  fill,
  center,
  children,
}: {
  step: TourStepName;
  /** Stretch to the parent's width (cards); otherwise the wrapper hugs its content. */
  fill?: boolean;
  /** Keep the target centred in a centring parent (the SOS in the tab bar). */
  center?: boolean;
  children: ReactNode;
}) {
  const steps = useContext(StepsContext);
  const { current } = useSpotlightTour();
  const ref = useRef<ViewInstance>(null);
  useEffect(() => {
    if (ref.current) anchors.set(step, ref.current);
    updateSteps();
    return () => {
      anchors.delete(step);
      updateSteps();
    };
  }, [step]);
  const index = steps.indexOf(step);
  const active = index >= 0 && current === index;
  // Same tree before and after the provider lists the step (index -1 never runs), so the
  // registered view stays the mounted one.
  return (
    <AttachStep index={index} fill={fill} style={center ? { alignSelf: 'center' } : undefined}>
      <View ref={ref} collapsable={false}>
        {children}
        {active ? (
          <View
            pointerEvents="none"
            className={cn(
              'border-brand absolute border-2',
              INSIDE.has(step) ? 'inset-0 rounded-t-lg' : '-inset-1.5',
              ROUND.has(step) ? 'rounded-full' : INSIDE.has(step) ? null : 'rounded-xl',
            )}
          />
        ) : null}
      </View>
    </AttachStep>
  );
}

/**
 * Starts the tour once, `ready` = the screen has its content (Body after startup), and again
 * whenever Settings asks for it.
 */
export function useAutoStartTour(ready: boolean) {
  const { start, current } = useSpotlightTour();
  useEffect(() => {
    if (!ready) return;
    const run = () => {
      if (current !== undefined) return;
      requested = false;
      onScreen = 'body';
      start();
    };
    // Let the first frame lay out (and the anchors register) before the spotlight measures.
    let id = !seen() || requested ? setTimeout(run, 900) : undefined;
    // Repeated requests (a double tap in Settings) start it once.
    const onRequest = () => {
      if (id) clearTimeout(id);
      id = setTimeout(run, 900);
    };
    requestListeners.add(onRequest);
    return () => {
      if (id) clearTimeout(id);
      requestListeners.delete(onRequest);
    };
  }, [ready, start, current]);
}
