// Test data generators (`@haven/core/testdata`): ONLY for seeds, tests and development tools.
// No screen or product code imports this module. Readings look like real records
// (`simulated: false`, realistic `source`); they are loaded as data, never as product logic.
export { scenarios } from '../config/testdata';
export {
  crewRole,
  DEMO_COMMANDER,
  DEMO_CREW,
  DEMO_MISSION,
  DEMO_MISSION_CONTROL,
  DEMO_MISSION_NAME,
  type DemoCrewMember,
  HABITAT_MODULES,
} from './demo';
export * from './ecg';
export { mulberry32 } from './prng';
export * from './provider';
export * from './scenario';
export {
  CREW_PROFILES,
  type DemoHistoryOptions,
  demoHistory,
  demoMissedDays,
  generateSeries,
  SERIES,
  type SeriesDef,
  SOURCE_BY_INDICATOR,
} from './series';
