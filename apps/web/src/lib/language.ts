import 'server-only';
import { cookies } from 'next/headers';
import { DEFAULT_LANGUAGE, isLanguage, LANGUAGE_COOKIE, type Language } from './i18n';

export async function getLanguage(): Promise<Language> {
  const value = (await cookies()).get(LANGUAGE_COOKIE)?.value;
  return isLanguage(value) ? value : DEFAULT_LANGUAGE;
}

export async function getTexts<T>(texts: { es: T; en: T }): Promise<{ lang: Language; t: T }> {
  const lang = await getLanguage();
  return { lang, t: texts[lang] };
}
