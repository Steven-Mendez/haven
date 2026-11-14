import type { Reading } from '@haven/core';
import { demoHistory } from '@haven/core/testdata';
import { describe, expect, it } from 'vitest';
import {
  markerForClosedEmergency,
  markersFromMissionChange,
  markersInWindow,
  SAME_EMERGENCY_MS,
  type TrendMarker,
} from './markers';
import { aggregateSeries, firstReadingMs, rangeWindow } from './series';

const NOW = Date.parse('2026-11-01T12:00:00Z');
const HOUR = 3_600_000;

function reading(t: number, value: number | string): Reading {
  return {
    id: `r${t}`,
    indicator: 'heart-rate',
    value,
    unit: 'bpm',
    takenAt: new Date(t).toISOString(),
    source: 'watch',
    simulated: false,
    crewMember: 'elena-vega',
  };
}

describe('range windows', () => {
  it('day, week and mission', () => {
    expect(rangeWindow('day', NOW)).toEqual([NOW - 24 * HOUR, NOW]);
    expect(rangeWindow('week', NOW)).toEqual([NOW - 7 * 24 * HOUR, NOW]);
    expect(rangeWindow('mission', NOW, NOW - 10 * 24 * HOUR)).toEqual([NOW - 10 * 24 * HOUR, NOW]);
    expect(rangeWindow('mission', NOW)[0]).toBe(NOW - 30 * 24 * HOUR);
    // A mission that started an hour ago still shows at least a day.
    expect(rangeWindow('mission', NOW, NOW - HOUR)[0]).toBe(NOW - 24 * HOUR);
  });
});

describe('aggregateSeries', () => {
  it('averages into buckets and pins the last bucket to the latest reading', () => {
    const readings = [
      reading(NOW - 3 * HOUR, 60),
      reading(NOW - 3 * HOUR + 60_000, 70),
      reading(NOW - HOUR, 80),
      reading(NOW - HOUR + 60_000, 90),
      reading(NOW - 30 * HOUR, 100), // outside the day
      reading(NOW - 2 * HOUR, 'sinus'), // not numeric
    ];
    const s = aggregateSeries(readings, 'day', rangeWindow('day', NOW), HOUR);
    expect(s.count).toBe(4);
    expect(s.data).toHaveLength(2);
    expect(s.data[0]?.[1]).toBe(65);
    expect(s.data[1]).toEqual([NOW - HOUR + 60_000, 90]);
    expect(s.last?.value).toBe(90);
  });

  it('returns an empty series for an empty window', () => {
    const empty = aggregateSeries([], 'week', rangeWindow('week', NOW));
    expect(empty).toMatchObject({ data: [], count: 0 });
  });

  it('keeps 30 days of recorded heart rate light enough to draw smoothly (≤ 130 points)', () => {
    const history = demoHistory('elena-vega', new Date(NOW)).filter(
      (r) => r.indicator === 'heart-rate',
    );
    expect(history.length).toBeGreaterThan(100);
    const start = firstReadingMs(history);
    const s = aggregateSeries(history, 'mission', rangeWindow('mission', NOW, start));
    expect(s.data.length).toBeGreaterThan(20);
    expect(s.data.length).toBeLessThanOrEqual(130);
    const week = aggregateSeries(history, 'week', rangeWindow('week', NOW));
    expect(week.data.length).toBeLessThanOrEqual(90);
    for (let i = 1; i < s.data.length; i++) {
      expect((s.data[i] as [number, number])[0]).toBeGreaterThan(
        (s.data[i - 1] as [number, number])[0],
      );
    }
  });
});

describe('markers', () => {
  it('records environment changes only', () => {
    expect(markersFromMissionChange(undefined, { environment: 'mars' }, NOW)).toEqual([]);
    const out = markersFromMissionChange({ environment: 'transit' }, { environment: 'mars' }, NOW);
    expect(out.map((m) => [m.kind, m.ref])).toEqual([['environment', 'mars']]);
    expect(markersFromMissionChange({ environment: 'mars' }, { environment: 'mars' }, NOW)).toEqual(
      [],
    );
  });

  it('keeps one emergency marker per packet id and updates it when the close is re-emitted', () => {
    let markers: TrendMarker[] = [];
    const upsert = (m: TrendMarker | undefined) => {
      if (m) markers = [...markers.filter((k) => k.id !== m.id), m];
    };
    // Opened, then closed with packet p1: the open marker is linked, not duplicated.
    upsert({ id: 'open', t: NOW - HOUR, kind: 'emergency', ref: 'button' });
    upsert(markerForClosedEmergency(markers, NOW, 'p1'));
    expect(markers).toHaveLength(1);
    expect(markers[0]).toMatchObject({ id: 'open', packet: 'p1' });
    // Re-emitted with the same packet (a note was added): still one marker.
    expect(markerForClosedEmergency(markers, NOW - HOUR, 'p1')).toBeUndefined();
    upsert(markerForClosedEmergency(markers, NOW + 60_000, 'p1'));
    expect(markers).toHaveLength(1);
    expect(markers[0]).toMatchObject({ id: 'open', packet: 'p1', t: NOW + 60_000 });
    // A close without a prior open: one marker keyed by the packet, stable on re-emission.
    upsert(markerForClosedEmergency(markers, NOW + 5 * HOUR, 'p2'));
    upsert(markerForClosedEmergency(markers, NOW + 5 * HOUR + 1, 'p2'));
    expect(markers.filter((m) => m.packet === 'p2')).toHaveLength(1);
    expect(markers.find((m) => m.packet === 'p2')?.id).toBe('emergency:packet:p2');
  });

  it('does not duplicate an emergency that was recorded when it opened', () => {
    const opened: TrendMarker = { id: 'e', t: NOW - HOUR, kind: 'emergency', ref: 'button' };
    expect(markerForClosedEmergency([opened], NOW)).toBeUndefined();
    expect(markerForClosedEmergency([opened], NOW - HOUR + SAME_EMERGENCY_MS + 1)).toBeDefined();
    expect(markerForClosedEmergency([], NOW)?.kind).toBe('emergency');
  });

  it('collapses close markers: an emergency wins, otherwise the latest', () => {
    const close: TrendMarker[] = [
      { id: 'e', t: NOW - 3 * HOUR, kind: 'emergency', ref: 'button' },
      { id: 's', t: NOW - 2 * HOUR, kind: 'environment', ref: 'moon' },
      { id: 'm', t: NOW - 1 * HOUR, kind: 'environment', ref: 'mars' },
    ];
    expect(markersInWindow(close, rangeWindow('day', NOW)).map((m) => m.id)).toEqual(['e']);
    expect(markersInWindow(close.slice(1), rangeWindow('day', NOW)).map((m) => m.id)).toEqual([
      'm',
    ]);
  });

  it('filters to the window and keeps emergencies when trimming', () => {
    const markers: TrendMarker[] = [
      { id: '1', t: NOW - 2 * 24 * HOUR, kind: 'environment', ref: 'mars' },
      { id: '2', t: NOW - 3 * HOUR, kind: 'emergency', ref: 'button' },
      { id: '3', t: NOW - 2 * HOUR, kind: 'environment', ref: 'moon' },
      { id: '4', t: NOW - HOUR, kind: 'environment', ref: 'mars' },
    ];
    expect(markersInWindow(markers, rangeWindow('day', NOW), 6, 0).map((m) => m.id)).toEqual([
      '2',
      '3',
      '4',
    ]);
    expect(markersInWindow(markers, rangeWindow('week', NOW), 2, 0).map((m) => m.id)).toEqual([
      '2',
      '4',
    ]);
  });
});
