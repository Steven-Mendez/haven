import type { Level } from '@haven/core';
import * as Haptics from 'expo-haptics';
import { useEffect, useRef, useState } from 'react';
import { Animated, Easing, type GestureResponderEvent, Platform, View } from 'react-native';
import { useReducedMotion } from 'react-native-reanimated';
import {
  Circle,
  ClipPath,
  Defs,
  G,
  Line,
  LinearGradient,
  Path,
  Rect,
  Stop,
  Svg,
  Text as SvgText,
} from 'react-native-svg';

import { Text } from '@/shared/components/ui/text';
import { useLanguage, useTexts } from '@/shared/i18n';
import { MOTION, useColors } from '@/shared/lib/theme';
import { cn } from '@/shared/lib/utils';

import { format, havenTexts } from './i18n';
import { levelLabel } from './level';
import { bucketSeries, flaggedPoints, niceTicks } from './logic/chart-math';
import { monotonePath } from './logic/monotone';
import { useUnitLabel } from './unit-label';

export type ChartEvent = {
  /** Epoch ms. */
  t: number;
  /** Short label (≤ 14 characters reads well), e.g. "Emergency", "Mars". */
  label: string;
  kind?: 'emergency' | 'environment' | 'other';
};

type Props = {
  /** `[epoch ms, value][]`, any order. Same shape as the Earth API `series`. */
  data: [number, number][];
  /** Personal baseline from the engine (`Assessment.baseline`): band + dashed line + inline label. */
  baseline?: { median: number; range: [number, number] };
  /**
   * Reference range from the config (`Indicator.green`): always inside the y-domain (so in-range
   * noise looks calm) and points outside it get a level colour.
   */
  referenceRange?: [number, number];
  /**
   * Aggregate to one point per window (median) before drawing, with the min–max of each window as
   * a faint 6 % area: 7 d and 4 w → 1 d. 0 / undefined = raw points (1 d).
   */
  bucketMs?: number;
  events?: ChartEvent[];
  /** 200 on the indicator screen (full-bleed), 120 in cards. */
  height?: number;
  /** `Indicator.unit` id (or an already translated label): shown via `useUnitLabel`. */
  unit?: string;
  /** @deprecated Ignored: the line always uses the foreground colour. */
  color?: string;
  /** Level of the latest reading: colours the last point when it is out of range. */
  lastLevel?: Level;
  /** Level of any point (amber/red points get their colour; others stay on the line). */
  levelAt?: (t: number, value: number) => Level | undefined;
  /** Fixed x domain (e.g. the selected range) instead of the data extent. */
  timeDomain?: [number, number];
  formatTime?: (t: number) => string;
  formatValue?: (v: number) => string;
  /**
   * Scrubbing (Robinhood / Garmin): called with the point under the finger while dragging and with
   * `null` on release, so the screen updates its hero number instead of showing a tooltip.
   */
  onScrub?: (point: [number, number] | null) => void;
  /** Reading line above the chart (only when nobody listens to `onScrub`). Default false. */
  readout?: boolean;
  /** @deprecated No legends: the baseline is labelled inline. */
  legend?: boolean;
  /** Edge-to-edge plot with labels inset 16 (detail screens). Default true. */
  bleed?: boolean;
  accessibilityLabel?: string;
  className?: string;
};

const INSET = 16;
const TOP = 14;
const BOTTOM = 22;
const MAX_POINTS_FOR_HAPTICS = 400;

const AnimatedRect = Animated.createAnimatedComponent(Rect);

/**
 * Trend chart (shared chart spec): 1.5 pt monotone-cubic foreground line with a soft area
 * (8 % → 0 %), personal range band (5 %), dashed baseline labelled inline, ≤ 3 horizontal grid
 * lines, right-side y labels and start / middle / end x labels — no axes, no legend. Only the last
 * point (with a halo) and out-of-range points (level colour) are dotted. Drag to scrub: a 1 px
 * cursor plus `onScrub` (with a selection haptic per point). Draws in once (400 ms ease-out);
 * Reduce Motion: no draw-in.
 */
export function SeriesChart({
  data,
  baseline,
  referenceRange,
  bucketMs,
  events = [],
  height = 200,
  unit: unitId,
  lastLevel,
  levelAt,
  timeDomain,
  formatTime,
  formatValue = (v) => String(Math.round(v * 10) / 10),
  onScrub,
  readout = false,
  bleed = true,
  accessibilityLabel,
  className,
}: Props) {
  const colors = useColors();
  const t = useTexts(havenTexts);
  const language = useLanguage();
  const unitOf = useUnitLabel();
  const reduce = useReducedMotion();
  const unit = unitId ? unitOf(unitId) : unitId;
  const [width, setWidth] = useState(0);
  const [cursor, setCursor] = useState<number | null>(null);
  const reveal = useRef(new Animated.Value(reduce ? 1 : 0)).current;
  const drawn = useRef(false);

  const fmtTime =
    formatTime ??
    ((ms: number) => new Date(ms).toLocaleDateString(language, { day: 'numeric', month: 'short' }));
  const fmtFull = (ms: number) =>
    new Date(ms).toLocaleString(language, {
      day: 'numeric',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit',
    });

  const raw = [...data].filter(([, v]) => Number.isFinite(v)).sort((a, b) => a[0] - b[0]);
  const buckets = bucketSeries(raw, bucketMs ?? 0);
  const points: [number, number][] = buckets.map((b) => [b.t, b.median]);
  // The real latest reading stays the last point (a bucket median would hide it).
  const latestRaw = raw.at(-1);
  if (latestRaw && bucketMs && points.length) points[points.length - 1] = latestRaw;
  const last = points.at(-1);

  // Draw once, when the chart first has a size and data.
  useEffect(() => {
    if (drawn.current || width === 0 || points.length === 0) return;
    drawn.current = true;
    if (reduce) {
      reveal.setValue(1);
      return;
    }
    Animated.timing(reveal, {
      toValue: 1,
      duration: MOTION.figure,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: false,
    }).start();
  }, [width, points.length, reduce, reveal]);

  const outOfRange = (v: number) =>
    referenceRange ? v < referenceRange[0] || v > referenceRange[1] : false;
  const levelOf = (i: number): Level | undefined => {
    const p = points[i];
    if (!p) return undefined;
    const given = i === points.length - 1 && lastLevel ? lastLevel : levelAt?.(p[0], p[1]);
    if (given === 'amber' || given === 'red') return given;
    return outOfRange(p[1]) ? 'amber' : undefined;
  };

  const summary =
    accessibilityLabel ??
    (last
      ? `${points.length} · ${t.latestReading}: ${formatValue(last[1])} ${unit ?? ''}${
          lastLevel ? `, ${levelLabel(t, lastLevel)}` : ''
        }`
      : t.chartEmpty);

  // Domain: the data, the personal band AND the reference range, + 10 % (an empty chart still
  // shows its grid). Including the reference keeps normal noise calm instead of «spiky».
  const values = raw.map(([, v]) => v);
  if (baseline) values.push(baseline.range[0], baseline.range[1]);
  if (referenceRange) values.push(referenceRange[0], referenceRange[1]);
  let vMin = values.length ? Math.min(...values) : 0;
  let vMax = values.length ? Math.max(...values) : 1;
  if (vMax - vMin < 1e-6) {
    vMin -= 1;
    vMax += 1;
  }
  const vPad = (vMax - vMin) * 0.1;
  vMin -= vPad;
  vMax += vPad;
  const now = Date.now();
  const [t0, t1] =
    timeDomain ??
    (points.length ? [points[0][0], (last as [number, number])[0]] : [now - 86_400_000, now]);
  const tSpan = Math.max(t1 - t0, 1);

  // Edge-to-edge grid; the plot stops before the right label column so labels never sit on data.
  const left = bleed ? 0 : 4;
  const right = points.length ? 60 : 12;
  const plotW = Math.max(width - left - right, 1);
  const plotH = height - TOP - BOTTOM;
  const x = (ms: number) => left + ((ms - t0) / tSpan) * plotW;
  const y = (v: number) => TOP + (1 - (v - vMin) / (vMax - vMin)) * plotH;

  const xy = points.map(([ms, v]) => [x(ms), y(v)] as [number, number]);
  const line = monotonePath(xy);
  const area =
    xy.length > 1
      ? `${line} L ${xy[xy.length - 1][0]} ${TOP + plotH} L ${xy[0][0]} ${TOP + plotH} Z`
      : '';
  const ticks = niceTicks(vMin, vMax, 3);
  const timeTicks = [t0, t0 + tSpan / 2, t1];

  // Safety: every raw reading that needs attention is drawn at its real time and value, even
  // when the line shows daily medians (the y-domain already includes all raw values).
  const flagged = flaggedPoints(raw, {
    levelAt,
    referenceRange,
    personalRange: baseline?.range,
  });
  // Scrub targets: the drawn points plus the flagged readings (snap to whichever is closer).
  const targets: [number, number][] = [
    ...points,
    ...flagged.map((f) => [f.t, f.v] as [number, number]),
  ]
    .sort((a, b) => a[0] - b[0])
    .filter((p, i, all) => i === 0 || p[0] !== all[i - 1][0] || p[1] !== all[i - 1][1]);
  const txy = targets.map(([ms, v]) => [x(ms), y(v)] as [number, number]);
  const nearest = (px: number, py: number) => {
    let best = 0;
    const d = (i: number) => Math.abs(txy[i][0] - px) + 0.25 * Math.abs(txy[i][1] - py);
    for (let i = 1; i < txy.length; i++) if (d(i) < d(best)) best = i;
    return best;
  };
  const onTouch = (e: GestureResponderEvent) => {
    if (!targets.length) return;
    const i = nearest(e.nativeEvent.locationX, e.nativeEvent.locationY);
    if (i !== cursor) {
      if (Platform.OS !== 'web' && targets.length < MAX_POINTS_FOR_HAPTICS)
        void Haptics.selectionAsync();
      setCursor(i);
      onScrub?.(targets[i]);
    }
  };
  const release = () => {
    setCursor(null);
    onScrub?.(null);
  };

  const shown = cursor !== null ? targets[cursor] : points[points.length - 1];
  const fg = colors.foreground;
  const baseLabel = baseline ? format(t.baseShort, { b: formatValue(baseline.median) }) : '';
  // Y labels never collide with the baseline label (both live in the right gutter).
  const yLabels = ticks.filter((v) => !baseline || Math.abs(y(v) - y(baseline.median)) > 20);
  const rangeArea =
    bucketMs && buckets.length > 1 && buckets.some((b) => b.max > b.min)
      ? `${monotonePath(buckets.map((b) => [x(b.t), y(b.max)] as [number, number]))} L ${[
          ...buckets,
        ]
          .reverse()
          .map((b) => `${x(b.t)} ${y(b.min)}`)
          .join(' L ')} Z`
      : '';
  const revealWidth = reveal.interpolate({ inputRange: [0, 1], outputRange: [0, width] });

  return (
    <View className={cn('gap-2', className)}>
      {readout && !onScrub ? (
        <Text
          className={cn('text-caption tabular-nums', bleed && 'px-4')}
          accessibilityLiveRegion="polite"
        >
          {shown ? (
            <>
              <Text className="text-body-sm font-semibold">{formatValue(shown[1])}</Text>
              <Text className="text-muted-foreground">
                {`${unit ? ` ${unit}` : ''} · ${fmtFull(shown[0])}`}
              </Text>
            </>
          ) : (
            <Text className="text-muted-foreground">{t.chartEmpty}</Text>
          )}
        </Text>
      ) : null}

      <View
        accessible
        accessibilityRole="image"
        accessibilityLabel={summary}
        style={{ height }}
        onLayout={(e) => setWidth(e.nativeEvent.layout.width)}
        onStartShouldSetResponder={() => points.length > 0}
        onMoveShouldSetResponder={() => points.length > 0}
        onResponderGrant={onTouch}
        onResponderMove={onTouch}
        onResponderRelease={release}
        onResponderTerminate={release}
        onResponderTerminationRequest={() => cursor === null}
      >
        {width > 0 ? (
          <Svg width={width} height={height}>
            <Defs>
              <LinearGradient id="haven-area" x1="0" y1="0" x2="0" y2="1">
                <Stop offset="0" stopColor={fg} stopOpacity={0.08} />
                <Stop offset="1" stopColor={fg} stopOpacity={0} />
              </LinearGradient>
              <ClipPath id="haven-reveal">
                <AnimatedRect x={0} y={0} width={revealWidth} height={height} />
              </ClipPath>
            </Defs>

            {/* ≤ 3 horizontal grid lines, labels on the right (inset 16). */}
            {ticks.map((v) => (
              <Line
                key={`g${v}`}
                x1={0}
                x2={width}
                y1={y(v)}
                y2={y(v)}
                stroke={colors.chart.grid}
                strokeWidth={1}
              />
            ))}
            {points.length
              ? yLabels.map((v) => (
                  <SvgText
                    key={`l${v}`}
                    x={width - INSET}
                    y={y(v) - 4}
                    fontSize={11}
                    fill={colors.tertiary}
                    textAnchor="end"
                  >
                    {formatValue(v)}
                  </SvgText>
                ))
              : null}

            {baseline ? (
              <G>
                <Rect
                  x={0}
                  width={width}
                  y={y(baseline.range[1])}
                  height={Math.max(y(baseline.range[0]) - y(baseline.range[1]), 1)}
                  fill={fg}
                  fillOpacity={0.05}
                />
                <Line
                  x1={0}
                  x2={width}
                  y1={y(baseline.median)}
                  y2={y(baseline.median)}
                  stroke={colors.tertiary}
                  strokeDasharray="3 3"
                  strokeWidth={1}
                />
                {/* Inline label in the right gutter, outside the plot, on a black pill. */}
                <Rect
                  x={width - INSET - baseLabel.length * 6.2 - 4}
                  y={y(baseline.median) - 8}
                  width={baseLabel.length * 6.2 + 8}
                  height={16}
                  rx={8}
                  fill={colors.background}
                />
                <SvgText
                  x={width - INSET}
                  y={y(baseline.median) + 4}
                  fontSize={11}
                  fill={colors.tertiary}
                  textAnchor="end"
                >
                  {baseLabel}
                </SvgText>
              </G>
            ) : null}

            {/* Events: quiet dashed vertical line + label (emergency in its level colour). */}
            {events
              .filter((e) => e.t >= t0 && e.t <= t1)
              .map((e) => {
                const ex = x(e.t);
                const anchor = ex > plotW * 0.7 ? 'end' : 'start';
                const tone = e.kind === 'emergency' ? colors.level.red.fg : colors.tertiary;
                return (
                  <G key={`e${e.t}${e.label}`}>
                    <Line
                      x1={ex}
                      x2={ex}
                      y1={TOP}
                      y2={TOP + plotH}
                      stroke={colors.borderStrong}
                      strokeDasharray="2 3"
                      strokeWidth={1}
                    />
                    <SvgText
                      x={anchor === 'end' ? ex - 5 : ex + 5}
                      y={TOP + 8}
                      fontSize={11}
                      fill={tone}
                      textAnchor={anchor}
                    >
                      {e.label}
                    </SvgText>
                  </G>
                );
              })}

            <G clipPath="url(#haven-reveal)">
              {rangeArea ? <Path d={rangeArea} fill={fg} fillOpacity={0.06} /> : null}
              {area ? <Path d={area} fill="url(#haven-area)" /> : null}
              {xy.length > 1 ? (
                <Path
                  d={line}
                  stroke={fg}
                  strokeWidth={1.5}
                  strokeLinejoin="round"
                  strokeLinecap="round"
                  fill="none"
                />
              ) : null}
            </G>

            {/* Readings that need attention, on top of the line at their real value: 3 pt dot in
                the level colour with a 1.5 pt black ring (never hidden by aggregation). */}
            {flagged.map((f) => (
              <Circle
                key={`f${f.t}-${f.v}`}
                cx={x(f.t)}
                cy={y(f.v)}
                r={3}
                fill={colors.level[f.level].fg}
                stroke={colors.background}
                strokeWidth={1.5}
              />
            ))}

            {/* Last point: solid dot + 15 % halo (level colour when out of range). */}
            {last && cursor === null
              ? (() => {
                  const [lx, ly] = xy[xy.length - 1];
                  const level = levelOf(xy.length - 1);
                  const c = level ? colors.level[level].fg : fg;
                  return (
                    <G>
                      <Circle cx={lx} cy={ly} r={10} fill={c} fillOpacity={0.15} />
                      <Circle cx={lx} cy={ly} r={4} fill={c} />
                    </G>
                  );
                })()
              : null}

            {/* Scrub cursor: 1 px line + highlighted point. */}
            {cursor !== null && txy[cursor] ? (
              <G>
                <Line
                  x1={txy[cursor][0]}
                  x2={txy[cursor][0]}
                  y1={0}
                  y2={TOP + plotH}
                  stroke={colors.borderStrong}
                  strokeWidth={1}
                />
                <Circle
                  cx={txy[cursor][0]}
                  cy={txy[cursor][1]}
                  r={10}
                  fill={fg}
                  fillOpacity={0.15}
                />
                <Circle cx={txy[cursor][0]} cy={txy[cursor][1]} r={4} fill={fg} />
              </G>
            ) : null}

            {timeTicks.map((ms, i) => (
              <SvgText
                key={['start', 'mid', 'end'][i]}
                x={i === 0 ? INSET : i === 1 ? width / 2 : width - INSET}
                y={height - 4}
                fontSize={11}
                fill={colors.tertiary}
                textAnchor={i === 0 ? 'start' : i === 1 ? 'middle' : 'end'}
              >
                {fmtTime(ms)}
              </SvgText>
            ))}

            {points.length === 0 ? (
              <SvgText
                x={width / 2}
                y={TOP + plotH / 2 + 4}
                fontSize={13}
                fill={colors.tertiary}
                textAnchor="middle"
              >
                {t.chartEmpty}
              </SvgText>
            ) : null}
          </Svg>
        ) : null}
      </View>
    </View>
  );
}
