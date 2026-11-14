import {
  type Assessment,
  dailyProgress,
  evaluate,
  evaluateZones,
  type Level,
  loadConfig,
  type Reading,
} from '@haven/core';
import { describe, expect, it } from 'vitest';
import { activeAlerts, hasRed } from './alerts';
import { figureWidth, hitBoxes } from './figure-hit';
import { zoneOrigins } from './origins';
import { toggleZone, zoneDetail } from './zone-detail';

const config = loadConfig();

const assessment = (indicator: string, level: Level): Assessment => ({
  indicator,
  level,
  explanation: { es: 'x', en: 'x' },
  actions: [],
  ageMin: 5,
  simulated: false,
});

const reading = (indicator: string, source: Reading['source'], simulated: boolean): Reading => ({
  id: `${indicator}-${source}`,
  indicator,
  value: 1,
  unit: '',
  takenAt: '2026-11-01T10:00:00.000Z',
  source,
  simulated,
  crewMember: 'elena-vega',
});

describe('activeAlerts', () => {
  it('keeps only amber and red, red first, then config order', () => {
    const list = [
      assessment('glucose', 'amber'),
      assessment('heart-rate', 'green'),
      assessment('sleep', 'pending'),
      assessment('spo2', 'red'),
      assessment('systolic-bp', 'amber'),
    ];
    const alerts = activeAlerts(list, config);
    expect(alerts.map((a) => a.indicator.id)).toEqual(['spo2', 'systolic-bp', 'glucose']);
    expect(alerts[0]?.zone).toBe('lungs');
    expect(hasRed(alerts)).toBe(true);
  });

  it('ignores unknown indicators and has no red when only amber', () => {
    const alerts = activeAlerts([assessment('nope', 'red'), assessment('mood', 'amber')], config);
    expect(alerts.map((a) => a.indicator.id)).toEqual(['mood']);
    expect(hasRed(alerts)).toBe(false);
  });
});

describe('zoneDetail', () => {
  it('lists the zone indicators with their level; missing assessments are pending', () => {
    const list = [assessment('heart-rate', 'amber')];
    const detail = zoneDetail('heart', evaluateZones(list, config), list, config);
    expect(detail?.zone.id).toBe('heart');
    expect(detail?.indicators.map((i) => i.indicator.id)).toEqual(
      config.zones.find((z) => z.id === 'heart')?.indicators,
    );
    expect(detail?.indicators[0]?.level).toBe('amber');
    expect(detail?.indicators[1]?.level).toBe('pending');
    expect(detail?.indicators[1]?.assessment).toBeUndefined();
  });

  it('a zone without data is pending, never green', () => {
    const detail = zoneDetail('skin', [], [], config);
    expect(detail?.level).toBe('pending');
    expect(detail?.indicators.every((i) => i.level === 'pending')).toBe(true);
  });

  it('returns undefined for an unknown zone and toggles selection', () => {
    expect(zoneDetail('tail', [], [], config)).toBeUndefined();
    expect(toggleZone(undefined, 'heart')).toBe('heart');
    expect(toggleZone('heart', 'heart')).toBeUndefined();
    expect(toggleZone('heart', 'lungs')).toBe('lungs');
  });
});

describe('day ring is independent from health (M01 acceptance)', () => {
  it('completing a zone daily action fills its segment without changing levels or alerts', () => {
    const now = new Date('2026-11-01T12:00:00.000Z');
    const glucose = {
      ...reading('glucose', 'manual', false),
      value: 140,
      takenAt: now.toISOString(),
    };
    const before = [glucose];
    const assessmentsBefore = evaluate(before, config, 'transit', {}, [], now);
    const progressBefore = dailyProgress(before, config, now);

    const mark: Reading = {
      ...reading('daily-action', 'manual', false),
      value: 'lungs',
      takenAt: now.toISOString(),
    };
    const after = [...before, mark];
    const assessmentsAfter = evaluate(after, config, 'transit', {}, [], now);
    const progressAfter = dailyProgress(after, config, now);

    expect(progressBefore.find((p) => p.zone === 'lungs')?.progress).toBe(0);
    expect(progressAfter.find((p) => p.zone === 'lungs')?.progress).toBe(1);
    expect(evaluateZones(assessmentsAfter, config)).toEqual(
      evaluateZones(assessmentsBefore, config),
    );
    expect(activeAlerts(assessmentsAfter, config)).toEqual(activeAlerts(assessmentsBefore, config));
    expect(activeAlerts(assessmentsAfter, config).map((a) => a.indicator.id)).toEqual(['glucose']);
  });
});

describe('zoneOrigins', () => {
  it('collects distinct sources and missing indicators per zone', () => {
    const latest = new Map<string, Reading>([
      ['heart-rate', reading('heart-rate', 'watch', false)],
      ['systolic-bp', reading('systolic-bp', 'manual', false)],
      ['diastolic-bp', reading('diastolic-bp', 'manual', false)],
    ]);
    const origins = zoneOrigins(config, (id) => latest.get(id));
    const heart = origins.find((o) => o.zone === 'heart');
    expect(heart?.sources).toEqual(['watch', 'manual']);
    expect(heart?.missing).toEqual(['hrv', 'heart-rhythm']);
    const skin = origins.find((o) => o.zone === 'skin');
    expect(skin?.sources).toEqual([]);
    expect(skin?.missing.length).toBeGreaterThan(0);
  });
});

describe('figure hit targets', () => {
  it('gives Mind and Heart at least 48 pt, centred on their shapes', () => {
    const boxes = hitBoxes(300);
    expect(boxes.map((b) => b.zone).sort()).toEqual(['heart', 'mind']);
    for (const b of boxes) expect(b.size).toBeGreaterThanOrEqual(48);
    const heart = boxes.find((b) => b.zone === 'heart');
    expect((heart?.left ?? 0) + 24).toBeCloseTo((146 * 300) / 440);
    expect(hitBoxes(300, 20)[0]?.size).toBe(48);
    expect(figureWidth(440)).toBe(240);
  });
});
