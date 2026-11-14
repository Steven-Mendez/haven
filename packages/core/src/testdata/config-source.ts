import * as configModule from '../config';
import { scenarios } from '../config/testdata';
import type { Config, Scenario } from '../contracts';

const mod = configModule as Record<string, unknown>;

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

export function contentScenarios(): Scenario[] {
  return scenarios.filter(
    (s) => s && typeof s.id === 'string' && Array.isArray(s.series) && Array.isArray(s.events),
  );
}
