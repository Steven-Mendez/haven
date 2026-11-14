// T03 · Time copy without «0 min» (QA Pólux): under a minute reads «just now» / seconds.
import { ago } from '@/components/haven';
import { format, minutesBetween } from '@/lib/i18n';
import type { ExtrasTexts } from '../i18n';

/** «hace 12 min», or «hace un momento» under a minute. */
export function agoText(at: string, now: string | number | Date, t: ExtrasTexts): string {
  return minutesBetween(at, now) < 1 ? t.justNow : format(t.agoText, { t: ago(at, now) });
}
