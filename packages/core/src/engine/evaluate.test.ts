import { describe, expect, it } from 'vitest';
import type { Assessment, Reading } from '../contracts';
import { categoryLabel, configForEnvironment, evaluate, NO_DATA_AGE_MIN } from './evaluate';
import { NOW, reading, TEST_CONFIG } from './test-fixtures';

const catalog = [
  { id: 'hydrate', text: { es: 'Hidrátate', en: 'Hydrate' }, priority: 2 },
  { id: 'repeat-bp', text: { es: 'Repite la presión', en: 'Repeat BP' }, priority: 1 },
];

function run(
  readings: Reading[],
  opts?: { symptoms?: Reading[]; env?: string; baseline?: Record<string, Assessment['baseline']> },
): Record<string, Assessment> {
  const result = evaluate(
    readings,
    TEST_CONFIG,
    opts?.env ?? 'transit',
    opts?.baseline ?? {},
    opts?.symptoms ?? [],
    NOW,
    { actions: catalog },
  );
  return Object.fromEntries(result.map((a) => [a.indicator, a]));
}

describe('evaluate', () => {
  it('returns one assessment per config indicator', () => {
    expect(evaluate([], TEST_CONFIG, 'transit', {}, [], NOW)).toHaveLength(
      TEST_CONFIG.indicators.length,
    );
  });

  it('extras are never evaluated, whatever they read', () => {
    const config = {
      ...TEST_CONFIG,
      indicators: TEST_CONFIG.indicators.map((i) =>
        i.id === 'cabin-co2' ? { ...i, extra: true } : i,
      ),
    };
    const ids = (readings: Reading[]) =>
      evaluate(readings, config, 'transit', {}, [], NOW).map((a) => a.indicator);
    expect(ids([])).not.toContain('cabin-co2');
    expect(ids([reading('cabin-co2', 9, 10)])).not.toContain('cabin-co2');
    expect(ids([reading('cabin-co2', 9, 10)])).toHaveLength(config.indicators.length - 1);
  });

  it('no reading → pending, never green', () => {
    const a = run([])['heart-rate'];
    expect(a?.level).toBe('pending');
    expect(a?.ageMin).toBe(NO_DATA_AGE_MIN);
  });

  it('stale reading (older than everyHours × 1.5) → pending', () => {
    const r = run([reading('heart-rate', 72, 4 * 60 * 1.5 + 1)]);
    expect(r['heart-rate']?.level).toBe('pending');
    expect(run([reading('heart-rate', 72, 4 * 60 * 1.5)])['heart-rate']?.level).toBe('green');
  });

  it('blood pressure 150/95 → amber with explanation and prioritized actions', () => {
    const r = run([reading('systolic-bp', 150, 5), reading('diastolic-bp', 95, 5)]);
    expect(r['systolic-bp']?.level).toBe('amber');
    expect(r['systolic-bp']?.explanation.es).toBe('stage-2');
    expect(r['systolic-bp']?.actions.map((a) => a.id)).toEqual(['repeat-bp', 'hydrate']);
    expect(r['diastolic-bp']?.level).toBe('amber');
  });

  it('blood pressure 150 with symptoms → red', () => {
    const symptoms = [reading('symptom', 'dizziness', 10)];
    expect(run([reading('systolic-bp', 150, 5)], { symptoms })['systolic-bp']?.level).toBe('red');
  });

  it('heart rate 130 with symptoms → red; without → amber', () => {
    const hr = [reading('heart-rate', 130, 1)];
    expect(run(hr, { symptoms: [reading('symptom', 'chest-pain', 2)] })['heart-rate']?.level).toBe(
      'red',
    );
    expect(run(hr)['heart-rate']?.level).toBe('amber');
  });

  it('symptom readings inside `readings` count too; "none" and old ones do not', () => {
    expect(
      run([reading('heart-rate', 130, 1), reading('symptom', 'chest-pain', 3)])['heart-rate']
        ?.level,
    ).toBe('red');
    expect(
      run([reading('heart-rate', 130, 1), reading('symptom', 'none', 3)])['heart-rate']?.level,
    ).toBe('amber');
    expect(
      run([reading('heart-rate', 130, 1), reading('symptom', 'chest-pain', 7 * 60)])['heart-rate']
        ?.level,
    ).toBe('amber');
  });

  it('glucose 65 → amber without symptom, red with symptom', () => {
    expect(run([reading('glucose', 65)]).glucose?.level).toBe('amber');
    expect(run([reading('glucose', 65)]).glucose?.actions[0]?.id).toBe('rule-15-15');
    expect(
      run([reading('glucose', 65)], { symptoms: [reading('symptom', 'sweating', 5)] }).glucose
        ?.level,
    ).toBe('red');
  });

  it('SpO₂ 89 → red', () => {
    expect(run([reading('spo2', 89)]).spo2?.level).toBe('red');
  });

  it('sustainedMin: SpO₂ 93 for 5 min is watched (green), for 10 min is amber', () => {
    const short = run([reading('spo2', 98, 30), reading('spo2', 93, 5), reading('spo2', 93, 0)]);
    expect(short.spo2?.level).toBe('green');
    expect(short.spo2?.explanation.en).toContain('being watched');
    const long = run([reading('spo2', 93, 10), reading('spo2', 93, 4), reading('spo2', 93, 0)]);
    expect(long.spo2?.level).toBe('amber');
  });

  it('repetitions: three stress check-ins of 4 → amber; two → not amber', () => {
    const two = run([
      reading('stress', 2, 3000),
      reading('stress', 4, 1440),
      reading('stress', 4, 0),
    ]);
    expect(two.stress?.level).toBe('green');
    const three = run([
      reading('stress', 4, 2880),
      reading('stress', 4, 1440),
      reading('stress', 4, 0),
    ]);
    expect(three.stress?.level).toBe('amber');
    expect(three.stress?.explanation.es).toBe('stress-3');
  });

  it('value inside green but outside the personal baseline → amber', () => {
    const baseline = { 'systolic-bp': { median: 100, range: [96, 104] as [number, number] } };
    const r = run([reading('systolic-bp', 120)], { baseline });
    expect(r['systolic-bp']?.level).toBe('amber');
    expect(r['systolic-bp']?.explanation.es).toBe('baseline');
    expect(r['systolic-bp']?.baseline).toEqual(baseline['systolic-bp']);
    expect(run([reading('systolic-bp', 103)], { baseline })['systolic-bp']?.level).toBe('green');
  });

  it('closing rule: outside green with no matching rule → amber with repeat action', () => {
    const r = run([reading('working-memory', 2)]);
    expect(r['working-memory']?.level).toBe('amber');
    expect(r['working-memory']?.actions[0]?.id).toBe('repeat-measurement');
  });

  it('category indicators: irregular rhythm → red, sinus → green', () => {
    expect(run([reading('heart-rhythm', 'irregular')])['heart-rhythm']?.level).toBe('red');
    expect(run([reading('heart-rhythm', 'sinus')])['heart-rhythm']?.level).toBe('green');
  });

  it('most severe matching rule wins regardless of order', () => {
    const r = run([reading('glucose', 65)], { symptoms: [reading('symptom', 'confusion')] });
    expect(r.glucose?.level).toBe('red');
  });

  it('propagates simulated and age in minutes; ignores future readings', () => {
    const r = run([
      reading('heart-rate', 72, 42, { simulated: true }),
      reading('heart-rate', 180, -10),
    ]);
    expect(r['heart-rate']).toMatchObject({
      level: 'green',
      value: 72,
      ageMin: 42,
      simulated: true,
    });
  });

  it('changing a threshold in config changes the result without code', () => {
    const edited: typeof TEST_CONFIG = JSON.parse(JSON.stringify(TEST_CONFIG));
    const glucose = edited.indicators.find((i) => i.id === 'glucose');
    if (!glucose) throw new Error('fixture');
    glucose.rules = [];
    glucose.green = [60, 99];
    const a = evaluate([reading('glucose', 65)], edited, 'transit', {}, [], NOW);
    expect(a.find((x) => x.indicator === 'glucose')?.level).toBe('green');
  });

  it('environmentOverrides: CO₂ 2.8 is green in transit and amber on Mars', () => {
    expect(run([reading('cabin-co2', 2.8)])['cabin-co2']?.level).toBe('green');
    expect(run([reading('cabin-co2', 2.8)], { env: 'mars' })['cabin-co2']?.level).toBe('amber');
    const mars = configForEnvironment(TEST_CONFIG, 'mars');
    expect(mars.indicators.find((i) => i.id === 'cabin-co2')?.green).toEqual([0, 2.5]);
  });

  it('unknown action ids are kept with the id as text; at most three actions', () => {
    const r = run([reading('heart-rate', 130)], { symptoms: [reading('symptom', 'chest-pain')] });
    expect(r['heart-rate']?.actions).toEqual([
      { id: 'chest-pain', text: { es: 'chest-pain', en: 'chest-pain' }, priority: 100 },
    ]);
  });

  it('category explanation uses categoryLabels (raw value when missing)', () => {
    const labelled = JSON.parse(JSON.stringify(TEST_CONFIG)) as typeof TEST_CONFIG;
    const rhythm = labelled.indicators.find((i) => i.id === 'heart-rhythm');
    if (!rhythm) throw new Error('fixture');
    rhythm.categoryLabels = { sinus: { es: 'Sinusal', en: 'Sinus' } };
    const a = evaluate([reading('heart-rhythm', 'sinus')], labelled, 'transit', {}, [], NOW).find(
      (x) => x.indicator === 'heart-rhythm',
    );
    expect(a?.explanation).toEqual({ es: 'Sin hallazgos (Sinusal).', en: 'No findings (Sinus).' });
    expect(run([reading('heart-rhythm', 'sinus')])['heart-rhythm']?.explanation.es).toBe(
      'Sin hallazgos (sinus).',
    );
  });

  it('categoryLabel helper', () => {
    const ind = { categoryLabels: { irregular: { es: 'Irregular', en: 'Irregular' } } };
    expect(categoryLabel(ind, 'irregular', 'es')).toBe('Irregular');
    expect(categoryLabel(ind, 'sinus', 'en')).toBe('sinus');
    expect(categoryLabel({}, 3, 'es')).toBe('3');
  });
});
