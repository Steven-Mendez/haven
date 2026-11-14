import { describe, expect, it } from 'vitest';
import { firstEpisode, markPacketSent, onEmergencyOpen } from './episode';

describe('emergency episodes', () => {
  it('a new open during an emergency in progress keeps it and updates the origin', () => {
    const first = firstEpisode('button');
    expect(onEmergencyOpen(first, 'button')).toBe(first);
    expect(onEmergencyOpen(first, 'fall')).toEqual({
      number: 1,
      origin: 'fall',
      packetSent: false,
    });
  });

  it('watch SOS → End → spo2 trigger starts a new emergency with its own origin', () => {
    let episode = firstEpisode('button');
    episode = markPacketSent(episode);
    expect(markPacketSent(episode)).toBe(episode);
    episode = onEmergencyOpen(episode, 'spo2');
    expect(episode).toEqual({ number: 2, origin: 'spo2', packetSent: false });
    expect(onEmergencyOpen(episode, 'heartRate').number).toBe(2);
  });
});
