import { getLocales } from 'expo-localization';
import { useSyncExternalStore } from 'react';

// Per-feature texts, no library: each feature declares its texts in `i18n.ts` with
// `defineTexts` and reads them with `useTexts`. The initial language comes from the device
// (expo-localization); the saved preference replaces it when `@/shared/data` starts.
// `setLanguage` re-renders every component that uses `useTexts` or `useLanguage`.

export type Language = 'es' | 'en';

export const DEFAULT_LANGUAGE: Language = 'es';
export const LANGUAGES: readonly Language[] = ['es', 'en'];

/** Forces `en` to have exactly the same keys as `es`. */
export function defineTexts<T extends Record<string, string>>(texts: { es: T; en: T }) {
  return texts;
}

/** Device language, if supported. */
export function systemLanguage(): Language {
  try {
    const code = getLocales()[0]?.languageCode;
    return code === 'en' || code === 'es' ? code : DEFAULT_LANGUAGE;
  } catch {
    return DEFAULT_LANGUAGE;
  }
}

let current: Language = systemLanguage();
const listeners = new Set<(language: Language) => void>();

/** Current language outside React (services, notifications). */
export function currentLanguage(): Language {
  return current;
}

/** Changes the language of the whole app. `@/shared/data` persists it as a preference. */
export function setLanguage(language: Language) {
  if (language === current || !LANGUAGES.includes(language)) return;
  current = language;
  for (const listener of listeners) listener(language);
}

/** Listens to language changes outside React. Returns the unsubscribe function. */
export function onLanguageChange(listener: (language: Language) => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function subscribe(notify: () => void) {
  return onLanguageChange(notify);
}

export function useLanguage(): Language {
  return useSyncExternalStore(subscribe, currentLanguage, currentLanguage);
}

export function useTexts<T>(texts: { es: T; en: T }): T {
  return texts[useLanguage()];
}

/** Picks a config `I18n` value (`{ es, en }`) in the current language. */
export function useTranslate(): (text: { es: string; en: string } | undefined) => string {
  const language = useLanguage();
  return (text) => text?.[language] ?? '';
}
