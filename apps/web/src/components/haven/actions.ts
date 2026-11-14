'use server';

import { cookies } from 'next/headers';
import { isLanguage, LANGUAGE_COOKIE } from '@/lib/i18n';
import { MISSION_COOKIE } from '@/lib/mission';

const YEAR = 60 * 60 * 24 * 365;

export async function setLanguage(formData: FormData) {
  const lang = formData.get('lang');
  if (!isLanguage(lang)) return;
  (await cookies()).set(LANGUAGE_COOKIE, lang, { path: '/', maxAge: YEAR, sameSite: 'lax' });
}

export async function setMission(code: string) {
  const value = String(code).toUpperCase();
  if (!/^[A-Z0-9]{6}$/.test(value)) return;
  (await cookies()).set(MISSION_COOKIE, value, { path: '/', maxAge: YEAR, sameSite: 'lax' });
}
