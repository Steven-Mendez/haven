import { getLocales } from 'expo-localization';
import { useSyncExternalStore } from 'react';

export type Language = 'es' | 'en';

export const DEFAULT_LANGUAGE: Language = 'es';
export const LANGUAGES: readonly Language[] = ['es', 'en'];

export function defineTexts<T extends Record<string, string>>(texts: { es: T; en: T }) {
  return texts;
}

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

export function currentLanguage(): Language {
  return current;
}

export function setLanguage(language: Language) {
  if (language === current || !LANGUAGES.includes(language)) return;
  current = language;
  for (const listener of listeners) listener(language);
}

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

export function useTranslate(): (text: { es: string; en: string } | undefined) => string {
  const language = useLanguage();
  return (text) => text?.[language] ?? '';
}
