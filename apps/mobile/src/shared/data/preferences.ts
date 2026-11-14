import { type Language, systemLanguage } from '@/shared/i18n';

/** Persisted local preferences (`preferences` table). */
export type Preferences = {
  language: Language;
  /** Earth API base URL (contract D). */
  apiUrl: string;
  /** Crew member using this phone (an id of `Mission.crew`). */
  crewMember: string;
  /** Colour scheme (Settings › Appearance). Dark by default on board (low light, OLED). */
  appearance: Appearance;
};

export type Appearance = 'dark' | 'light' | 'system';

export function defaultPreferences(): Preferences {
  return {
    language: systemLanguage(),
    apiUrl: 'http://localhost:3000',
    crewMember: 'elena-vega',
    appearance: 'dark',
  };
}

/** Drops settings saved by old installs that no longer exist (time factor, simulation mode). */
export function withoutRemovedSettings(p: Preferences): Preferences {
  const {
    demoFactor: _f,
    simulationActive: _s,
    scenario: _c,
    ...rest
  } = p as Preferences & Record<string, unknown>;
  return rest as Preferences;
}
