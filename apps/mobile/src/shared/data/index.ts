// Local mobile data (M00, contract B).
//   store.saveReading(r)   → persists, emits 'reading:new', re-evaluates, emits 'assessments:changed'
//   store.readings({ indicator?, since?, until?, crewMember? })   synchronous, sorted by takenAt
//   store.assessments() / store.zones() / store.baseline(id)
//   store.mission() / store.setMission(partial)   → emits 'mission:changed'
//   store.preferences() / store.setPreferences(partial)
//   registerQueueCounter(fn)   M09: how to count pending sends (mission header)
export * from './hooks';
export { type Appearance, defaultPreferences, type Preferences } from './preferences';
export {
  type Baseline,
  type ReadingFilter,
  registerQueueCounter,
  store,
  type Topic,
  type Zones,
} from './store';
