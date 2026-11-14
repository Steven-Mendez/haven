import type { Assessment, Packet, Reading } from '@haven/core';

export type NoticeInput = {
  id: string;
  crewMember: string;
  mission: string;
  now: Date;
  assessments: Assessment[];
  readings: Reading[];
  notes: string;
};

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
    visibleAt: at,
  };
}
