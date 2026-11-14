// HAVEN design components for the Ground View, composed on shadcn/ui (`components/ui`).
// Pure presentation: no data access. Safe to import from server and client components.
// App chrome (sidebar, header, actions, fonts) is imported directly by the root layout. API in apps/web/DISENO.md.

export { type ActivityItem, ActivityList } from './activity-list';
export { ActivityRings } from './activity-rings';
export { AgeLabel, NO_RECENT_DATA_MIN, TimeAgo } from './age-label';
export {
  AstronautCard,
  crewDisplayLevel,
  crewMemberLevel,
  hasOpenEmergency,
} from './astronaut-card';
export { AstronautRow, AstronautTable, AstronautTableHeader } from './astronaut-row';
export { CollapsedGroup } from './collapsed-group';
export { CopyId, copyText } from './copy-id';
export { CrewHoverCard, CrewList, compactAgo, levelTip } from './crew-list';
export { CrewPeekProvider, PeekLink } from './crew-peek';
export { DayRing } from './day-ring';
export { EcgStrip } from './ecg-strip';
export { EmptyState } from './empty-state';
export { ExpandableRow } from './expandable-row';
export { FirstMission } from './first-mission';
export { Hint } from './hint';
export { LevelBadge } from './level-badge';
export { LevelGlyph } from './level-glyph';
export {
  ago,
  bySeverity,
  countLevels,
  LEVEL_ORDER,
  LEVELS,
  lastDataText,
  levelLabel,
  worstLevel,
  ZONE_ORDER,
} from './levels';
export { ListKeyboardNav } from './list-keyboard-nav';
export { MetricCard, type Trend } from './metric-card';
export { MissionHeader } from './mission-header';
export { MissionStats } from './mission-stats';
export { PageContainer, Section } from './page-container';
export { CREW_PORTRAITS, initials, Portrait } from './portrait';
export {
  crewRings,
  type DayRings,
  type RingDatum,
  type RingId,
  ringCount,
  weekRings,
} from './rings-data';
export { RingsLegend, ringName, ringsSummary, WeekRings } from './rings-legend';
export { RowContextMenu } from './row-context-menu';
export { type ChartMarker, type ChartRange, SeriesChart } from './series-chart';
export {
  AstronautCardSkeleton,
  Bar,
  CrewPageSkeleton,
  ListSkeleton,
  MetricCardSkeleton,
  MissionHeaderSkeleton,
  StatStripSkeleton,
} from './skeletons';
export { MiniTrend, Sparkline } from './sparkline';
export { type Stat, StatStrip } from './stat-strip';
export { type TermExplanation, TermTip } from './term-tip';
// `Term` / `explain` resolve the glossary from @haven/core: import them from './term' in server files only.
export { type HavenTexts, havenTexts } from './texts';
export { THEME_COOKIE } from './theme';
export { Timeline } from './timeline';
export type {
  AstronautResponse,
  CrewCard,
  CrewResponse,
  MissionInfo,
  MissionTotals,
  Now,
  ReceivedPacket,
  SeriesPoint,
  VisualLevel,
  ZoneLevel,
  ZoneProgress,
} from './types';
