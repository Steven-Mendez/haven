/** Part of the day for the greeting above the verdict (Garmin «Good afternoon, Sam»). */
export type DayPart = 'morning' | 'afternoon' | 'evening' | 'night';

/** By the phone's local hour: 5–11 morning, 12–19 afternoon, 20–23 evening, 0–4 night. */
export function dayPart(hour: number): DayPart {
  if (hour >= 5 && hour < 12) return 'morning';
  if (hour >= 12 && hour < 20) return 'afternoon';
  if (hour >= 20) return 'evening';
  return 'night';
}
