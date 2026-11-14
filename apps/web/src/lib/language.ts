import 'server-only';
import { cookies } from 'next/headers';
import { DEFAULT_LANGUAGE, isLanguage, LANGUAGE_COOKIE, type Language } from './i18n';

// Request language (server only). Reads the cookie set by the header language switcher.
// With Cache Components `cookies()` is a request-time API: call this inside a component wrapped in
// <Suspense> (views already are, because they read delayed data). See DISENO.md § Idioma.

export async function getLanguage(): Promise<Language> {
  const value = (await cookies()).get(LANGUAGE_COOKIE)?.value;
  return isLanguage(value) ? value : DEFAULT_LANGUAGE;
}

/** Shortcut for a view: `const { lang, t } = await getTexts(texts)`. */
export async function getTexts<T>(texts: { es: T; en: T }): Promise<{ lang: Language; t: T }> {
  const lang = await getLanguage();
  return { lang, t: texts[lang] };
}
