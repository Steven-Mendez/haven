import { type Language, systemLanguage } from '@/shared/i18n';

export type Preferences = {
  language: Language;
  apiUrl: string;
  crewMember: string;
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

export function withoutRemovedSettings(p: Preferences): Preferences {
  const {
    demoFactor: _f,
    simulationActive: _s,
    scenario: _c,
    ...rest
  } = p as Preferences & Record<string, unknown>;
  return rest as Preferences;
}
