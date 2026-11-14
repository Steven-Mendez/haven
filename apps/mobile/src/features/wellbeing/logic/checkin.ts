// M10 · Wellbeing check-in: pure logic. Mood and stress are readings; contact and the private journal
// are stored apart and never go into a Reading, an Assessment or a routine packet.
import type { Reading } from '@haven/core';

export const JOURNAL_MAX = 3000;
export const CONTACT_OPTIONS = ['crew', 'family', 'mission-control', 'nobody'] as const;
export type Contact = (typeof CONTACT_OPTIONS)[number];

/** Local collections (`db.collection`). */
export const CHECKIN_COLLECTION = 'wellbeing_checkins';
export const JOURNAL_COLLECTION = 'private_journal';

/** Non-clinical context of a check-in (stays on the phone). */
export type CheckinRecord = {
  id: string;
  crewMember: string;
  takenAt: string;
  contact: Contact[];
  /** Ids of the mood and stress readings it belongs to. */
  readingIds: string[];
};

/** Private journal entry: only on this device. */
export type JournalEntry = { id: string; crewMember: string; takenAt: string; text: string };

/** "Nobody" excludes every other option, and picking any other option clears "nobody". */
export function toggleContact(previous: Contact[], next: string[]): Contact[] {
  const valid = next.filter((c): c is Contact =>
    (CONTACT_OPTIONS as readonly string[]).includes(c),
  );
  const added = valid.filter((c) => !previous.includes(c));
  if (added.includes('nobody')) return ['nobody'];
  if (added.length > 0) return valid.filter((c) => c !== 'nobody');
  return valid;
}

/** Trims and caps the journal at 3000 characters. */
export function cleanJournal(text: string): string {
  return text.trim().slice(0, JOURNAL_MAX);
}

/** Mood and stress go together (both or neither). */
export function hasScales(
  mood: number | null | undefined,
  stress: number | null | undefined,
): boolean {
  return isScale(mood) && isScale(stress);
}

/**
 * Something to save: both scales, or only the optional part (contact or journal) when today's mood
 * and stress were already recorded (inline card in Routine, DESIGN_SYSTEM.md 4.1b).
 */
export function canSave(input: {
  mood?: number | null;
  stress?: number | null;
  contact: Contact[];
  journal: string;
  scalesDoneToday: boolean;
}): boolean {
  if (isScale(input.mood) !== isScale(input.stress)) return false;
  if (hasScales(input.mood, input.stress)) return true;
  if (!input.scalesDoneToday) return false;
  return input.contact.length > 0 || cleanJournal(input.journal).length > 0;
}

function isScale(v: number | null | undefined): v is number {
  return typeof v === 'number' && Number.isInteger(v) && v >= 1 && v <= 5;
}

export type CheckinInput = {
  /** Omit both when they were already recorded today. */
  mood?: number | null;
  stress?: number | null;
  contact: Contact[];
  journal: string;
  crewMember: string;
  takenAt: string;
  newId: () => string;
  unitOf: (indicator: string) => string;
};

/**
 * Splits a check-in into what may be evaluated (two `source: 'screen'` readings, no note) and what
 * stays local (contact record and, if written, the journal entry).
 */
export function buildCheckin(input: CheckinInput): {
  readings: Reading[];
  record: CheckinRecord;
  journal?: JournalEntry;
} {
  const scales = hasScales(input.mood, input.stress);
  if (!scales && (isScale(input.mood) || isScale(input.stress))) {
    throw new Error('mood and stress go together');
  }
  const base = {
    source: 'screen' as const,
    simulated: false,
    crewMember: input.crewMember,
    takenAt: input.takenAt,
  };
  const readings: Reading[] = scales
    ? (['mood', 'stress'] as const).map((indicator) => ({
        id: input.newId(),
        indicator,
        value: (indicator === 'mood' ? input.mood : input.stress) as number,
        unit: input.unitOf(indicator),
        ...base,
      }))
    : [];
  const text = cleanJournal(input.journal);
  return {
    readings,
    record: {
      id: input.newId(),
      crewMember: input.crewMember,
      takenAt: input.takenAt,
      contact: input.contact,
      readingIds: readings.map((r) => r.id),
    },
    journal: text
      ? { id: input.newId(), crewMember: input.crewMember, takenAt: input.takenAt, text }
      : undefined,
  };
}
