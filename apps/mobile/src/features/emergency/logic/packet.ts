import {
  type Assessment,
  type EmergencyStatus,
  type Packet,
  type Reading,
  SYMPTOM_INDICATOR,
  SYMPTOMS,
} from '@haven/core';

export type Symptom = (typeof SYMPTOMS)[number];
export const SYMPTOM_LIST: readonly Symptom[] = SYMPTOMS;

export const LOOKBACK_MIN = 30;

export type EmergencyOrigin =
  | 'button'
  | 'fall'
  | 'heartRate'
  | 'rhythm'
  | 'spo2'
  | 'notification'
  | 'assessment';

const ORIGINS: readonly EmergencyOrigin[] = [
  'button',
  'fall',
  'heartRate',
  'rhythm',
  'spo2',
  'notification',
  'assessment',
];

export function normalizeOrigin(value: unknown): EmergencyOrigin | undefined {
  return ORIGINS.includes(value as EmergencyOrigin) ? (value as EmergencyOrigin) : undefined;
}

export function symptomReading(
  symptom: Symptom,
  crewMember: string,
  now: Date,
  id: string,
): Reading {
  return {
    id,
    indicator: SYMPTOM_INDICATOR,
    value: symptom,
    unit: '',
    takenAt: now.toISOString(),
    source: 'screen',
    simulated: false,
    crewMember,
    note: 'emergency',
  };
}

export function emergencyReadings(
  readings: Reading[],
  crewMember: string,
  since: Date,
  now: Date,
): Reading[] {
  const from = since.getTime() - LOOKBACK_MIN * 60_000;
  const to = now.getTime();
  const seen = new Set<string>();
  return readings
    .filter((r) => {
      const t = new Date(r.takenAt).getTime();
      if (r.crewMember !== crewMember || t < from || t > to || seen.has(r.id)) return false;
      seen.add(r.id);
      return true;
    })
    .sort((a, b) => a.takenAt.localeCompare(b.takenAt));
}

export type Photo = NonNullable<Packet['photos']>[number];

export type PacketInput = {
  id: string;
  crewMember: string;
  missionCode: string;
  assessments: Assessment[];
  readings: Reading[];
  symptoms: Reading[];
  startedAt: Date;
  now: Date;
  notes: string;
  decisions: string[];
  originLabel?: string;
  photos: Photo[];
  ecg?: Packet['ecg'];
  status?: EmergencyStatus;
  origin?: EmergencyOrigin;
  forOther?: boolean;
};

export function buildEmergencyPacket(input: PacketInput): Packet {
  const sentAt = input.now.toISOString();
  const readings = emergencyReadings(
    [...input.readings, ...input.symptoms],
    input.crewMember,
    input.startedAt,
    input.now,
  );
  const notes = [
    input.originLabel,
    input.notes.trim(),
    input.decisions.length > 0 ? input.decisions.join('\n') : undefined,
  ]
    .filter(Boolean)
    .join('\n\n');
  return {
    id: input.id,
    type: 'emergency',
    crewMember: input.crewMember,
    assessments: input.assessments,
    readings,
    notes,
    photos: input.photos.length > 0 ? input.photos : undefined,
    ecg: input.ecg && input.ecg.microvolts.length > 0 ? input.ecg : undefined,
    emergency: input.status
      ? {
          id: input.id,
          status: input.status,
          startedAt: input.startedAt.toISOString(),
          ...(input.origin ? { origin: input.origin } : {}),
          ...(input.forOther ? { forOther: true } : {}),
        }
      : undefined,
    mission: input.missionCode,
    createdAt: input.startedAt.toISOString(),
    sentAt,
    visibleAt: sentAt,
  };
}

export function packetSummary(packet: Packet): {
  measurements: number;
  symptoms: number;
  photos: number;
  ecg: boolean;
  assessments: number;
} {
  const symptomReadings = packet.readings.filter((r) => r.indicator === SYMPTOM_INDICATOR);
  return {
    measurements: packet.readings.length - symptomReadings.length,
    symptoms: new Set(symptomReadings.map((r) => String(r.value))).size,
    photos: packet.photos?.length ?? 0,
    ecg: !!packet.ecg,
    assessments: packet.assessments.filter((a) => a.level !== 'pending').length,
  };
}
