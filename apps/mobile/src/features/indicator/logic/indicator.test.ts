import { evaluate, type Indicator, loadConfig, type Reading } from '@haven/core';
import { describe, expect, it } from 'vitest';
import { categoryText } from './category';
import { formatNumber, formatRange } from './format';
import {
  dailyActionZone,
  entryIndicators,
  isOutsideReference,
  manualReading,
  parseNumber,
  referenceSide,
  validateNumber,
} from './manual-entry';
import { baselineDelta, previewAssessments } from './preview';
import { appliedRule, indicatorForEnvironment, ruleConditions } from './rule';
import { categoriesOf, chartPoints, chartValue, rangeDomain } from './series';
import { parseSource } from './sources';

const config = loadConfig({ includeExtras: true });
const byId = (id: string) => config.indicators.find((i) => i.id === id) as Indicator;
const now = new Date('2026-11-01T12:00:00.000Z');

const manual = (indicator: string, value: number | string, minutesAgo = 1) =>
  manualReading({
    id: `${indicator}-${minutesAgo}`,
    indicator: byId(indicator),
    value,
    crewMember: 'elena-vega',
    takenAt: new Date(now.getTime() - minutesAgo * 60_000).toISOString(),
  });

describe('manual entry', () => {
  it('blood pressure records two readings in one form', () => {
    expect(entryIndicators('systolic-bp')).toEqual(['systolic-bp', 'diastolic-bp']);
    expect(entryIndicators('diastolic-bp')).toEqual(['systolic-bp', 'diastolic-bp']);
    expect(entryIndicators('glucose')).toEqual(['glucose']);
  });

  it('parses decimal commas and rejects text', () => {
    expect(parseNumber('36,8')).toBe(36.8);
    expect(parseNumber(' 150 ')).toBe(150);
    expect(parseNumber('12a')).toBeUndefined();
    expect(validateNumber('')).toBe('empty');
    expect(validateNumber('abc')).toBe('notNumber');
    expect(validateNumber('95')).toBeUndefined();
  });

  it('marks values outside the reference range from the config', () => {
    const glucose = byId('glucose');
    expect(isOutsideReference(glucose, glucose.green[1] + 1)).toBe(true);
    expect(isOutsideReference(glucose, glucose.green[0])).toBe(false);
    expect(referenceSide(glucose, glucose.green[0] - 1)).toBe('below');
    expect(referenceSide(glucose, glucose.green[1] + 1)).toBe('above');
    expect(isOutsideReference(byId('heart-rhythm'), 1)).toBe(false);
  });

  it('builds a manual, non-simulated reading with the config unit', () => {
    const r = manual('glucose', 110);
    expect(r).toMatchObject({ source: 'manual', simulated: false, unit: 'mg/dL', value: 110 });
  });

  it('knows which zone has the indicator as its daily action', () => {
    expect(dailyActionZone(config, 'systolic-bp')).toBe('vitals');
    expect(dailyActionZone(config, 'diastolic-bp')).toBe('vitals');
    expect(dailyActionZone(config, 'spo2')).toBeUndefined();
  });

  it('a 150/95 pressure gives amber with an explanation and an action (M02 acceptance)', () => {
    const readings: Reading[] = [manual('systolic-bp', 150), manual('diastolic-bp', 95)];
    const assessments = evaluate(readings, config, 'transit', {}, [], now);
    for (const id of ['systolic-bp', 'diastolic-bp']) {
      const a = assessments.find((x) => x.indicator === id);
      expect(a?.level).toBe('amber');
      expect(a?.explanation.es.length).toBeGreaterThan(0);
      expect(a?.actions.length).toBeGreaterThan(0);
      const rule = appliedRule(byId(id), a as NonNullable<typeof a>);
      expect(rule?.outside).toEqual(byId(id).green);
    }
  });
});

describe('applied rule', () => {
  it('finds the matching rule and lists its conditions', () => {
    const readings = [manual('glucose', 60)];
    const a = evaluate(readings, config, 'transit', {}, [], now).find(
      (x) => x.indicator === 'glucose',
    );
    expect(a?.level).toBe('amber');
    const rule = appliedRule(byId('glucose'), a as NonNullable<typeof a>);
    expect(rule).toBeDefined();
    expect(ruleConditions(rule as NonNullable<typeof rule>, 'number')[0]).toEqual({
      kind: 'outside',
      range: [70, 1000],
    });
  });

  it('returns no rule for green or pending', () => {
    const a = evaluate([manual('glucose', 85)], config, 'transit', {}, [], now).find(
      (x) => x.indicator === 'glucose',
    );
    expect(a?.level).toBe('green');
    expect(appliedRule(byId('glucose'), a as NonNullable<typeof a>)).toBeUndefined();
  });

  it('separates symptoms from categories by indicator kind', () => {
    const rhythmRed = byId('heart-rhythm').rules[0];
    expect(ruleConditions(rhythmRed as NonNullable<typeof rhythmRed>, 'category')).toEqual([
      { kind: 'categories', categories: ['irregular'] },
      { kind: 'withSymptoms', symptoms: [] },
    ]);
    const glucoseRed = byId('glucose').rules[0];
    const conditions = ruleConditions(glucoseRed as NonNullable<typeof glucoseRed>, 'number');
    expect(conditions.find((c) => c.kind === 'withSymptoms')).toMatchObject({
      symptoms: expect.arrayContaining(['sweating']),
    });
  });

  it('applies environment overrides', () => {
    const spo2Mars = indicatorForEnvironment(config, 'spo2', 'mars');
    const base = byId('spo2');
    expect(spo2Mars?.green).toEqual(base.environmentOverrides?.mars?.green ?? base.green);
  });
});

describe('series', () => {
  it('builds the domain and keeps points inside it', () => {
    const [from, to] = rangeDomain('day', now.getTime());
    expect(to - from).toBe(86_400_000);
    const points = chartPoints(
      byId('glucose'),
      [manual('glucose', 90, 60), manual('glucose', 95, 60 * 30)],
      [from, to],
    );
    expect(points).toEqual([[now.getTime() - 3_600_000, 90]]);
  });

  it('maps categories to their index', () => {
    const rhythm = byId('heart-rhythm');
    expect(categoriesOf(rhythm)).toEqual(['sinus', 'irregular']);
    expect(chartValue(rhythm, 'irregular')).toBe(1);
    expect(chartValue(rhythm, 'other')).toBeUndefined();
    expect(chartValue(byId('glucose'), '88')).toBe(88);
  });
});

describe('live preview', () => {
  it('previews the level the engine would give before saving (150/95 → amber)', () => {
    const [sys, dia] = previewAssessments({
      config,
      environment: 'transit',
      readings: [],
      candidates: [manual('systolic-bp', 150), manual('diastolic-bp', 95)],
      baselines: {},
      symptoms: [],
      now,
    });
    expect(sys?.indicator).toBe('systolic-bp');
    expect(sys?.level).toBe('amber');
    expect(dia?.level).toBe('amber');
  });

  it('counts active symptoms (low glucose + sweating → red)', () => {
    const symptom: Reading = {
      ...manual('glucose', 0),
      id: 's1',
      indicator: 'symptom',
      value: 'sweating',
      source: 'screen',
    };
    const [glucose] = previewAssessments({
      config,
      environment: 'transit',
      readings: [],
      candidates: [manual('glucose', 60)],
      baselines: {},
      symptoms: [symptom],
      now,
    });
    expect(glucose?.level).toBe('red');
  });

  it('computes the delta to the baseline median', () => {
    expect(baselineDelta(150, { median: 114, range: [110, 118] })).toBe(36);
    expect(baselineDelta(150, undefined)).toBeUndefined();
    expect(baselineDelta(undefined, { median: 1, range: [0, 2] })).toBeUndefined();
  });
});

describe('format', () => {
  it('uses the locale separator and at most one decimal', () => {
    expect(formatNumber(36.84, 'es')).toBe('36,8');
    expect(formatNumber(120, 'en')).toBe('120');
    expect(formatNumber(0.36, 'en')).toBe('0.36');
    expect(formatRange([35.5, 37.9], 'en')).toBe('35.5–37.9');
  });
});

describe('guide sources', () => {
  it('splits «Title: url» into a titled link', () => {
    expect(
      parseSource('MedlinePlus, Pulse: https://medlineplus.gov/ency/article/003399.htm'),
    ).toEqual({
      title: 'MedlinePlus, Pulse',
      url: 'https://medlineplus.gov/ency/article/003399.htm',
    });
    expect(parseSource('https://www.nasa.gov/hrp/')).toEqual({
      title: 'www.nasa.gov',
      url: 'https://www.nasa.gov/hrp/',
    });
    expect(parseSource('Tabla de indicadores de HAVEN')).toEqual({
      title: 'Tabla de indicadores de HAVEN',
    });
  });

  it('every config guide source has a title', () => {
    for (const i of config.indicators)
      for (const s of i.guide.sources) expect(parseSource(s).title.length).toBeGreaterThan(0);
  });
});

describe('categoryText', () => {
  it('uses the bundled labels when the active indicator has none', () => {
    const rhythm = byId('heart-rhythm');
    const fromEarth = { ...rhythm, categoryLabels: undefined };
    expect(categoryText(fromEarth, rhythm, 'sinus', 'es')).toBe('Sinusal');
    expect(categoryText(rhythm, undefined, 'irregular', 'en')).toBe('Irregular');
    expect(categoryText(fromEarth, undefined, 'sinus', 'en')).toBe('sinus');
  });
});
