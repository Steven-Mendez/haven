import { ago } from '@/components/haven';
import { format, minutesBetween } from '@/lib/i18n';
import type { ExtrasTexts } from '../i18n';

export function agoText(at: string, now: string | number | Date, t: ExtrasTexts): string {
  return minutesBetween(at, now) < 1 ? t.justNow : format(t.agoText, { t: ago(at, now) });
}
