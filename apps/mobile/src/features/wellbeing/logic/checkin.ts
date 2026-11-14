import type { Reading } from '@haven/core';

export const JOURNAL_MAX = 3000;
export const CONTACT_OPTIONS = ['crew', 'family', 'mission-control', 'nobody'] as const;
export type Contact = (typeof CONTACT_OPTIONS)[number];

export const CHECKIN_COLLECTION = 'wellbeing_checkins';
export const JOURNAL_COLLECTION = 'private_journal';

export type CheckinRecord = {
  id: string;
  crewMember: string;
  takenAt: string;
  contact: Contact[];
  readingIds: string[];
};

export type JournalEntry = { id: string; crewMember: string; takenAt: string; text: string };

export function toggleContact(previous: Contact[], next: string[]): Contact[] {
  const valid = next.filter((c): c is Contact =>
    (CONTACT_OPTIONS as readonly string[]).includes(c),
  );
  const added = valid.filter((c) => !previous.includes(c));
  if (added.includes('nobody')) return ['nobody'];
  if (added.length > 0) return valid.filter((c) => c !== 'nobody');
  return valid;
}

export function cleanJournal(text: string): string {
  return text.trim().slice(0, JOURNAL_MAX);
}

export function hasScales(
  mood: number | null | undefined,
  stress: number | null | undefined,
): boolean {
  return isScale(mood) && isScale(stress);
}

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
  mood?: number | null;
  stress?: number | null;
  contact: Contact[];
  journal: string;
  crewMember: string;
  takenAt: string;
  newId: () => string;
  unitOf: (indicator: string) => string;
};

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
