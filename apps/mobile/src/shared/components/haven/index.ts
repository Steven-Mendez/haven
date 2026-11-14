// HAVEN design components (owner: mobile UX/UI designer). Presentational only:
// they receive data through props and never import features or `@/shared/data`.
// Source of truth: haven/DESIGN_SYSTEM.md + design/tokens.json. Mobile notes: apps/mobile/DISENO.md.

export { ActionRow, ListGroup } from './action-row';
export { ActivityRings, type RingDatum, RingLegend, RingSpark } from './activity-rings';
export { BigButton } from './big-button';
export { BodyFigure, BodyLegend } from './body-figure';
export { CollapsedGroup } from './collapsed-group';
export { DataLabel, OriginLink, sourceLabel } from './data-label';
export { DayRing, WeekDots } from './day-ring';
export { EmptyState } from './empty-state';
export { HoldToConfirm } from './hold-to-confirm';
export { ageText, format, formatMetric, type HavenTexts, havenTexts } from './i18n';
export { IndicatorCard } from './indicator-card';
export { InlineConfirm } from './inline-confirm';
export {
  LEVEL_BAR_CLASS,
  LEVEL_BG_CLASS,
  LEVEL_BORDER_CLASS,
  LEVEL_TEXT_CLASS,
  levelLabel,
  levelPhrase,
  ZONE_ICON,
  zoneIcon,
  zoneName,
  zoneSummary,
} from './level';
export { LevelBadge } from './level-badge';
export { LevelGroups } from './level-groups';
export { LevelMeter, LevelShape, LevelSymbol } from './level-symbol';
export { ListDataLabel } from './list-data-label';
export { hasDay, type MissionPhase, missionPhase } from './logic/mission-phase';
export { pointLevel } from './logic/point-level';
export { useMissionPhaseText } from './mission-phase-text';
export { MissionStrip } from './mission-strip';
export { RegisterEntry } from './register-entry';
export { ScaleInput, type ScaleValue } from './scale-input';
export { ScreenHeader, Section } from './section';
export { SegmentedControl, SegmentedProgress } from './segmented';
export { type ChartEvent, SeriesChart } from './series-chart';
export { SosButton } from './sos-button';
export { BarChart, Sparkline } from './sparkline';
export { formatClock, StepTimer, useCountdown } from './step-timer';
export { TrendDelta } from './trend-delta';
export { useUnitLabel } from './unit-label';
