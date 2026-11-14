// M10 · Notice to Earth after the second failed battery in a row (the engine sets `notifyEarth`).
import type { Assessment, Packet, Reading } from '@haven/core';

export type NoticeInput = {
  id: string;
  crewMember: string;
  mission: string;
  now: Date;
  assessments: Assessment[];
  readings: Reading[];
  /** Plain-language note for Earth (already in the crew member's language). */
  notes: string;
};

/**
 * Routine packet for M09 (`bus.emit('packet:enqueue', { packet })`). `sentAt` is the request time. Never carries the private journal.
 */
export function cognitiveNoticePacket(input: NoticeInput): Packet {
  const at = input.now.toISOString();
  return {
    id: input.id,
    type: 'routine',
    crewMember: input.crewMember,
    assessments: input.assessments,
    readings: input.readings,
    notes: input.notes,
    mission: input.mission,
    createdAt: at,
    sentAt: at,
    // No artificial delay: Earth sees it when it receives it (EQUIPOS.md «Producto real»).
    visibleAt: at,
  };
}
