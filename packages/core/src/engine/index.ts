// C01 · Rules engine — ../obsidian/40 Proyecto/45 Core/C01 Motor de reglas.md
// Pure functions, no React, no storage. Time comes in as the `now` parameter.
// API documented in packages/core/README.md.
export {
  ACTION_NOTIFY_EARTH,
  ACTION_RECORD,
  ACTION_REPEAT,
  ACTION_REPEAT_BATTERY,
  defaultActionCatalog,
  registerActionCatalog,
  resolveActions,
} from './actions';
export * from './aggregates';
export * from './baseline';
export * from './categories';
export * from './cognition';
export * from './evaluate';
export * from './protocols';
export * from './radiation';
export * from './routine';
export { LEVEL_ORDER, worstLevel } from './util';
export * from './visible-at';
export * from './watch-readings';
export * from './zones';
