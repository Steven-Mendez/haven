// M07 · Health data sources — ../obsidian/40 Proyecto/43 Móvil/M07 Fuentes de datos de salud.md
// Public API: the "Data sources" screen (route `sources`) and `startHealthSources()`, called once
// from the root layout. Providers: HealthKit (iOS), pedometer fallback, Health Connect and BLE
// (unavailable in this build). All readings go through `store.saveReadings`, deduplicated.
export { default } from './screen';
export { startHealthSources } from './service';
