import type { Assessment, Mission, Packet, Reading } from '@haven/core';

// M09 · Routine packet composition and privacy exclusions (objective 6, closed decision 3).
// Emergency packets always travel complete: exclusions only apply to `type: 'routine'`.

/** Wellbeing answers the crew member may keep on board (M10 `ScaleInput`). */
export const MOOD_INDICATORS = ['mood', 'stress'] as const;
/** Diary of M10: kept on board unless the astronaut includes it; once sent, Earth shows it. */
export const DIARY_INDICATOR = 'diary';
/** Readings from the last 24 h go in a routine packet… */
export const RECENT_HOURS = 24;
/** …at most this many per indicator (the most recent). */
export const MAX_PER_INDICATOR = 24;

/** `true` = left out of the packet. */
export type Exclusions = { notes: boolean; mood: boolean; diary: boolean };

/** The diary is excluded by default and only travels if the crew member includes it. */
export const DEFAULT_EXCLUSIONS: Exclusions = { notes: false, mood: false, diary: true };

const isMood = (indicator: string) => (MOOD_INDICATORS as readonly string[]).includes(indicator);

/** Recent readings: last `RECENT_HOURS` up to `now`, capped per indicator, sorted by `takenAt`. */
export function recentReadings(readings: Reading[], now: Date, hours = RECENT_HOURS): Reading[] {
  const from = new Date(now.getTime() - hours * 3_600_000).toISOString();
  const to = now.toISOString();
  const byIndicator = new Map<string, Reading[]>();
  for (const r of readings) {
    if (r.takenAt < from || r.takenAt > to) continue;
    const list = byIndicator.get(r.indicator) ?? [];
    list.push(r);
    byIndicator.set(r.indicator, list);
  }
  const out: Reading[] = [];
  for (const list of byIndicator.values()) {
    list.sort((a, b) => a.takenAt.localeCompare(b.takenAt));
    out.push(...list.slice(-MAX_PER_INDICATOR));
  }
  return out.sort((a, b) => a.takenAt.localeCompare(b.takenAt));
}

/** Removes what the crew member excluded. Emergency packets are returned untouched. */
export function applyExclusions(packet: Packet, exclusions: Exclusions): Packet {
  if (packet.type === 'emergency') return packet;
  let readings = packet.readings;
  let assessments = packet.assessments;
  let notes = packet.notes;
  let photos = packet.photos;
  if (exclusions.diary) readings = readings.filter((r) => r.indicator !== DIARY_INDICATOR);
  if (exclusions.mood) {
    readings = readings.filter((r) => !isMood(r.indicator));
    assessments = assessments.filter((a) => !isMood(a.indicator));
  }
  if (exclusions.notes) {
    notes = '';
    readings = readings.map(({ note: _note, ...r }) => r);
    photos = photos?.map(({ note: _note, ...p }) => p);
  }
  return { ...packet, readings, assessments, notes, ...(photos ? { photos } : {}) };
}

export type RoutineInput = {
  id: string;
  mission: Pick<Mission, 'code'>;
  crewMember: string;
  assessments: Assessment[];
  /** All readings of the crew member; only recent ones are kept. */
  readings: Reading[];
  dailyProgress: { zone: string; progress: number }[];
  notes?: string;
  now: Date;
};

/**
 * Routine packet before exclusions: assessments, recent readings, `dailyProgress` and mission code.
 * `sentAt`/`visibleAt` are provisional; the queue stamps them (`stampPacket`).
 */
export function composeRoutinePacket(input: RoutineInput): Packet {
  const createdAt = input.now.toISOString();
  return {
    id: input.id,
    type: 'routine',
    crewMember: input.crewMember,
    mission: input.mission.code,
    assessments: input.assessments,
    readings: recentReadings(
      input.readings.filter((r) => r.crewMember === input.crewMember),
      input.now,
    ),
    notes: input.notes?.trim() ?? '',
    dailyProgress: input.dailyProgress,
    createdAt,
    sentAt: createdAt,
    visibleAt: createdAt,
  };
}

export type PacketSummary = {
  assessments: number;
  readings: number;
  /** Packet note plus reading and photo notes. */
  notes: number;
  mood: number;
  diary: number;
  photos: number;
  ecgSamples: number;
  zones: number;
};

export function summarize(packet: Packet): PacketSummary {
  const readingNotes = packet.readings.filter((r) => Boolean(r.note)).length;
  const photoNotes = (packet.photos ?? []).filter((p) => Boolean(p.note)).length;
  return {
    assessments: packet.assessments.length,
    readings: packet.readings.filter((r) => r.indicator !== DIARY_INDICATOR).length,
    notes: (packet.notes.trim() ? 1 : 0) + readingNotes + photoNotes,
    mood: packet.readings.filter((r) => isMood(r.indicator)).length,
    diary: packet.readings.filter((r) => r.indicator === DIARY_INDICATOR).length,
    photos: packet.photos?.length ?? 0,
    ecgSamples: packet.ecg?.microvolts.length ?? 0,
    zones: packet.dailyProgress?.length ?? 0,
  };
}

/**
 * Normalizes a packet coming from another feature (`emergency:close`, `packet:enqueue`): fills a
 * missing id, crew member, mission code, notes and dates. Never removes content.
 */
export function normalizeIncoming(
  packet: Partial<Packet> & Pick<Packet, 'type'>,
  defaults: { id: string; crewMember: string; mission: string; now: Date },
): Packet {
  const createdAt = packet.createdAt ?? defaults.now.toISOString();
  return {
    ...packet,
    id: packet.id || defaults.id,
    type: packet.type,
    crewMember: packet.crewMember || defaults.crewMember,
    mission: packet.mission || defaults.mission,
    assessments: packet.assessments ?? [],
    readings: packet.readings ?? [],
    notes: packet.notes ?? '',
    createdAt,
    sentAt: packet.sentAt ?? createdAt,
    visibleAt: packet.visibleAt ?? createdAt,
  };
}
