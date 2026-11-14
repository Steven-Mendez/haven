// Language of the Ground View. Pure module: safe on the server and in client components.
// To read the request language use `getLanguage()` / `getTexts()` from `@/lib/language` (server only).
// See apps/web/DISENO.md § Idioma.
import type { I18n } from '@haven/core';

export type Language = 'es' | 'en';

export const LANGUAGES: readonly Language[] = ['es', 'en'];
export const DEFAULT_LANGUAGE: Language = 'es';
/** Cookie written by the language switcher in the app header. */
export const LANGUAGE_COOKIE = 'haven-lang';

export function isLanguage(value: unknown): value is Language {
  return value === 'es' || value === 'en';
}

/** Forces `en` to have exactly the same keys as `es`. */
export function defineTexts<T extends Record<string, string>>(texts: { es: T; en: T }) {
  return texts;
}

/** A feature's texts in the given language: `const t = textsFor(texts, lang)`. */
export function textsFor<T>(texts: { es: T; en: T }, lang: Language): T {
  return texts[lang];
}

/** Config copy (`I18n` from @haven/core: explanations, zone names…) in the given language. */
export function translate(text: I18n | undefined, lang: Language): string {
  if (!text) return '';
  return text[lang] || text.es;
}

/** Replaces `{key}` in a template: `format('{n} min ago', { n: 4 })`. */
export function format(template: string, values: Record<string, string | number>): string {
  return template.replace(/\{(\w+)\}/g, (_, key: string) => String(values[key] ?? `{${key}}`));
}

const LOCALES: Record<Language, string> = { es: 'es-ES', en: 'en-GB' };

export function localeOf(lang: Language): string {
  return LOCALES[lang];
}

export function formatNumber(value: number, lang: Language, decimals = 0): string {
  return new Intl.NumberFormat(LOCALES[lang], {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(value);
}

function toDate(value: string | number | Date): Date {
  return value instanceof Date ? value : new Date(value);
}

/** 24 h time with explicit UTC (mission control works in UTC): «14:05 UTC». */
export function formatTime(value: string | number | Date, lang: Language): string {
  const time = new Intl.DateTimeFormat(LOCALES[lang], {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
    timeZone: 'UTC',
  }).format(toDate(value));
  return `${time} UTC`;
}

/** Clock time without the zone suffix, for chart ticks: «14:05» (UTC). */
export function formatClock(value: string | number | Date, lang: Language): string {
  return new Intl.DateTimeFormat(LOCALES[lang], {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
    timeZone: 'UTC',
  }).format(toDate(value));
}

/** Short date: «31 oct» / «31 Oct». */
export function formatDate(value: string | number | Date, lang: Language): string {
  return new Intl.DateTimeFormat(LOCALES[lang], {
    day: 'numeric',
    month: 'short',
    timeZone: 'UTC',
  }).format(toDate(value));
}

/** «31 oct · 14:05 UTC». */
export function formatDateTime(value: string | number | Date, lang: Language): string {
  return `${formatDate(value, lang)} · ${formatTime(value, lang)}`;
}

/** Whole minutes between two instants (never negative). */
export function minutesBetween(from: string | number | Date, to: string | number | Date): number {
  return Math.max(0, Math.floor((toDate(to).getTime() - toDate(from).getTime()) / 60_000));
}

/**
 * A one-way mission delay for display: seconds below 1 min (Lunar Gateway: 0.02 min → «1 s»),
 * otherwise like formatDuration («11 min», «1 h 4 min»).
 */
export function formatDelay(minutes: number): string {
  if (minutes < 1) return `${Math.max(1, Math.round(minutes * 60))} s`;
  return formatDuration(Math.round(minutes));
}

/** Readable duration, same in both languages: «45 min», «3 h 12 min», «2 d 4 h». */
export function formatDuration(minutes: number): string {
  if (minutes < 60) return `${minutes} min`;
  if (minutes < 60 * 24) {
    const h = Math.floor(minutes / 60);
    const m = minutes % 60;
    return m ? `${h} h ${m} min` : `${h} h`;
  }
  const days = Math.floor(minutes / (60 * 24));
  const h = Math.floor((minutes % (60 * 24)) / 60);
  return h ? `${days} d ${h} h` : `${days} d`;
}
