import type { I18n } from '@haven/core';

export type Language = 'es' | 'en';

export const LANGUAGES: readonly Language[] = ['es', 'en'];
export const DEFAULT_LANGUAGE: Language = 'es';
export const LANGUAGE_COOKIE = 'haven-lang';

export function isLanguage(value: unknown): value is Language {
  return value === 'es' || value === 'en';
}

export function defineTexts<T extends Record<string, string>>(texts: { es: T; en: T }) {
  return texts;
}

export function textsFor<T>(texts: { es: T; en: T }, lang: Language): T {
  return texts[lang];
}

export function translate(text: I18n | undefined, lang: Language): string {
  if (!text) return '';
  return text[lang] || text.es;
}

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

export function formatTime(value: string | number | Date, lang: Language): string {
  const time = new Intl.DateTimeFormat(LOCALES[lang], {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
    timeZone: 'UTC',
  }).format(toDate(value));
  return `${time} UTC`;
}

export function formatClock(value: string | number | Date, lang: Language): string {
  return new Intl.DateTimeFormat(LOCALES[lang], {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
    timeZone: 'UTC',
  }).format(toDate(value));
}

export function formatDate(value: string | number | Date, lang: Language): string {
  return new Intl.DateTimeFormat(LOCALES[lang], {
    day: 'numeric',
    month: 'short',
    timeZone: 'UTC',
  }).format(toDate(value));
}

export function formatDateTime(value: string | number | Date, lang: Language): string {
  return `${formatDate(value, lang)} · ${formatTime(value, lang)}`;
}

export function minutesBetween(from: string | number | Date, to: string | number | Date): number {
  return Math.max(0, Math.floor((toDate(to).getTime() - toDate(from).getTime()) / 60_000));
}

export function formatDelay(minutes: number): string {
  if (minutes < 1) return `${Math.max(1, Math.round(minutes * 60))} s`;
  return formatDuration(Math.round(minutes));
}

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
