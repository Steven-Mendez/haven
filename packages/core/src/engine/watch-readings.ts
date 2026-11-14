import type { Reading, WatchEnvelope, WatchMessages } from '../contracts';
import { ACUTE_EPISODE_NOTE } from './baseline';

export function readingsFromEnvelope(envelope: WatchEnvelope): Reading[] {
  const base = {
    source: 'watch' as const,
    simulated: envelope.simulated,
    crewMember: envelope.crewMember,
  };
  if (envelope.type === 'mood') {
    const p = envelope.payload as WatchMessages['mood'];
    return [
      {
        ...base,
        id: `watch-mood-${envelope.crewMember}-${p.takenAt}`,
        indicator: 'mood',
        value: p.score,
        unit: '1-5',
        takenAt: p.takenAt,
      },
    ];
  }
  if (envelope.type === 'monitor') {
    const p = envelope.payload as WatchMessages['monitor'];
    const out: Reading[] = [
      {
        ...base,
        id: `watch-hr-${envelope.crewMember}-${p.takenAt}`,
        indicator: 'heart-rate',
        value: p.heartRate,
        unit: 'bpm',
        takenAt: p.takenAt,
        note: ACUTE_EPISODE_NOTE,
      },
    ];
    if (p.spo2 !== undefined) {
      const takenAt = p.spo2TakenAt ?? p.takenAt;
      out.push({
        ...base,
        id: `watch-spo2-${envelope.crewMember}-${takenAt}`,
        indicator: 'spo2',
        value: p.spo2,
        note: ACUTE_EPISODE_NOTE,
        unit: '%',
        takenAt,
      });
    }
    return out;
  }
  if (envelope.type === 'emergency') {
    const p = envelope.payload as WatchMessages['emergency'];
    const takenAt = p.readingAt ?? p.takenAt;
    const out: Reading[] = [];
    if (p.heartRate !== undefined)
      out.push({
        ...base,
        id: `watch-hr-${envelope.crewMember}-${takenAt}`,
        indicator: 'heart-rate',
        value: p.heartRate,
        unit: 'bpm',
        takenAt,
        note: ACUTE_EPISODE_NOTE,
      });
    if (p.spo2 !== undefined)
      out.push({
        ...base,
        id: `watch-spo2-${envelope.crewMember}-${takenAt}`,
        indicator: 'spo2',
        value: p.spo2,
        unit: '%',
        takenAt,
        note: ACUTE_EPISODE_NOTE,
      });
    return out;
  }
  return [];
}
