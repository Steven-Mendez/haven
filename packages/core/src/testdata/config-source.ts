// Reads Content's config (`src/config`) by namespace so the test data works whatever its state.
import * as configModule from '../config';
import { scenarios } from '../config/testdata';
import type { Config, Scenario } from '../contracts';

const mod = configModule as Record<string, unknown>;

/** `loadConfig()` from src/config if it exists and has indicators; otherwise undefined. */
export function contentConfig(): Config | undefined {
  const load = mod.loadConfig;
  if (typeof load !== 'function') return undefined;
  try {
    const config = load() as Config;
    return Array.isArray(config?.indicators) && config.indicators.length > 0 ? config : undefined;
  } catch {
    return undefined;
  }
}

/** Valid test scenarios from `src/config/testdata` (entries without series/events are skipped). */
export function contentScenarios(): Scenario[] {
  return scenarios.filter(
    (s) => s && typeof s.id === 'string' && Array.isArray(s.series) && Array.isArray(s.events),
  );
}
