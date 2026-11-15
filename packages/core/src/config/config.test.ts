import { describe, expect, it } from 'vitest';
import type { I18n, Rule, Scenario } from '../contracts';
import {
  actionById,
  actions,
  DAILY_ACTION_SCREENS,
  EXTRA_INDICATORS,
  explainTerm,
  glossary,
  isTracked,
  loadConfig,
  missionDays,
  missionTemplates,
  phaseAt,
  phaseDelay,
  rebaseConfig,
  SYMPTOM_INDICATOR,
  SYMPTOMS,
  symptomById,
  symptoms,
  unitLabel,
  units,
} from './index';
import { scenarios } from './testdata';

const config = loadConfig();
const indicatorIds = new Set(config.indicators.map((i) => i.id));
const zoneIds = new Set(config.zones.map((z) => z.id));
const protocolIds = new Set(config.protocols.map((p) => p.id));
const environmentIds = new Set(config.environments.map((e) => e.id));
const actionIds = new Set(actions.map((a) => a.id));

const CHALLENGE_INDICATORS = [
  'heart-rate',
  'systolic-bp',
  'diastolic-bp',
  'glucose',
  'body-temperature',
  'sleep',
  'mood',
];

function expectI18n(value: I18n | undefined, where: string) {
  expect(value, where).toBeDefined();
  expect(value?.es.trim().length, `${where} (es)`).toBeGreaterThan(0);
  expect(value?.en.trim().length, `${where} (en)`).toBeGreaterThan(0);
}

function allRules(): { where: string; rule: Rule }[] {
  return config.indicators.flatMap((i) => [
    ...i.rules.map((rule, n) => ({ where: `${i.id}.rules[${n}]`, rule })),
    ...Object.entries(i.environmentOverrides ?? {}).flatMap(([env, o]) =>
      (o.rules ?? []).map((rule, n) => ({ where: `${i.id}.${env}.rules[${n}]`, rule })),
    ),
  ]);
}

describe('loadConfig', () => {
  it('joins the files into a tree with a semver version', () => {
    expect(config.version).toMatch(/^\d+\.\d+\.\d+$/);
    expect(config.zones).toHaveLength(5);
    expect(config.environments).toHaveLength(9);
  });

  it('exposes the action catalog', () => {
    expect(config.actions).toBe(actions);
    expect(actionById('go-to-shelter')?.protocol).toBe('radiation-shelter');
    expect(actionById('does-not-exist')).toBeUndefined();
  });
});

describe('zones', () => {
  it('uses the canonical ids', () => {
    expect([...zoneIds].sort()).toEqual(
      ['vitals', 'mind', 'performance', 'metabolism', 'environment'].sort(),
    );
  });

  it('match the zone field of their indicators both ways', () => {
    for (const z of config.zones) {
      for (const id of z.indicators) {
        expect(indicatorIds.has(id), `${z.id} → ${id}`).toBe(true);
        expect(config.indicators.find((i) => i.id === id)?.zone).toBe(z.id);
      }
    }
    for (const i of config.indicators) {
      expect(config.zones.find((z) => z.id === i.zone)?.indicators, i.id).toContain(i.id);
    }
  });

  it('have bilingual texts and a valid daily action', () => {
    const screens = new Set<string>(DAILY_ACTION_SCREENS);
    for (const z of config.zones) {
      expectI18n(z.name, `${z.id}.name`);
      expectI18n(z.purpose, `${z.id}.purpose`);
      expectI18n(z.dailyAction.text, `${z.id}.dailyAction.text`);
      expect(z.dailyAction.minutes).toBeGreaterThan(0);
      const opens = z.dailyAction.opens;
      expect(indicatorIds.has(opens) || screens.has(opens), `${z.id} opens ${opens}`).toBe(true);
    }
  });
});

describe('indicators', () => {
  it('have unique ids', () => {
    expect(indicatorIds.size).toBe(config.indicators.length);
  });

  it('flag exactly the challenge indicators', () => {
    const flagged = config.indicators.filter((i) => i.suggestedByChallenge).map((i) => i.id);
    expect(flagged.sort()).toEqual([...CHALLENGE_INDICATORS].sort());
  });

  it('map each indicator to one or more distinct RIDGE hazards', () => {
    const RIDGE = ['radiation', 'isolation', 'distance', 'gravity', 'environment'];
    for (const i of config.indicators) {
      expect(i.ridge.length, i.id).toBeGreaterThan(0);
      expect(new Set(i.ridge).size, i.id).toBe(i.ridge.length);
      for (const h of i.ridge) expect(RIDGE, i.id).toContain(h);
    }
  });

  it('tracks every indicator in the file: none is hidden and each one says how it is obtained', () => {
    expect([...EXTRA_INDICATORS]).toEqual([]);
    expect(config.indicators).toHaveLength(32);
    expect(loadConfig({ includeExtras: true }).indicators).toHaveLength(32);
    const INPUTS = ['watch', 'health', 'phone', 'test', 'check-in', 'manual'];
    for (const i of config.indicators) {
      expect(isTracked(i.id), i.id).toBe(true);
      expect(i.extra, i.id).toBeUndefined();
      expect(i.inputs.length, i.id).toBeGreaterThan(0);
      expect(new Set(i.inputs).size, i.id).toBe(i.inputs.length);
      for (const input of i.inputs) expect(INPUTS, i.id).toContain(input);
      expect(
        config.zones.filter((z) => z.indicators.includes(i.id)),
        i.id,
      ).toHaveLength(1);
    }
    expect(config.indicators.find((i) => i.id === 'heart-rhythm')?.categoryLabels?.sinus).toEqual({
      es: 'Sinusal',
      en: 'Sinus',
    });
  });

  it('have valid green ranges, names, units and sources', () => {
    for (const i of config.indicators) {
      expectI18n(i.name, `${i.id}.name`);
      expect(i.unit.length, i.id).toBeGreaterThan(0);
      expect(i.source.length, i.id).toBeGreaterThan(10);
      expect(i.green[0], i.id).toBeLessThanOrEqual(i.green[1]);
      expect(i.everyHours, i.id).toBeGreaterThan(0);
      for (const [env, o] of Object.entries(i.environmentOverrides ?? {})) {
        expect(environmentIds.has(env), `${i.id} override ${env}`).toBe(true);
        if (o.green) expect(o.green[0]).toBeLessThanOrEqual(o.green[1]);
      }
    }
  });

  it('have at least one rule when they are challenge indicators', () => {
    for (const id of CHALLENGE_INDICATORS) {
      expect(config.indicators.find((i) => i.id === id)?.rules.length, id).toBeGreaterThan(0);
    }
  });

  it('category indicators label every category their rules use, in es and en', () => {
    for (const i of config.indicators.filter((x) => x.kind === 'category')) {
      expect(i.categoryLabels, i.id).toBeDefined();
      for (const [key, label] of Object.entries(i.categoryLabels ?? {})) {
        expectI18n(label, `${i.id}.categoryLabels.${key}`);
      }
      const used = [
        ...i.rules,
        ...Object.values(i.environmentOverrides ?? {}).flatMap((o) => o.rules ?? []),
      ].flatMap((r) => r.categories ?? []);
      for (const c of used) expect(i.categoryLabels?.[c], `${i.id} → ${c}`).toBeDefined();
    }
  });

  it('numeric indicators carry no category labels (symptom names live in symptoms.json)', () => {
    for (const i of config.indicators.filter((x) => x.kind === 'number')) {
      expect(i.categoryLabels, i.id).toBeUndefined();
    }
  });

  it('category indicators only use rules with categories', () => {
    for (const i of config.indicators.filter((x) => x.kind === 'category')) {
      for (const r of i.rules) expect(r.categories?.length, i.id).toBeGreaterThan(0);
    }
  });
});

describe('rules', () => {
  it('have a condition, a bilingual explanation and known actions', () => {
    for (const { where, rule } of allRules()) {
      const hasCondition =
        rule.outside !== undefined ||
        rule.baselineDeviation !== undefined ||
        rule.categories !== undefined ||
        rule.withSymptoms === true;
      expect(hasCondition, where).toBe(true);
      if (rule.outside) expect(rule.outside[0], where).toBeLessThanOrEqual(rule.outside[1]);
      expectI18n(rule.explanation, `${where}.explanation`);
      expect(rule.actions.length, where).toBeGreaterThan(0);
      expect(rule.actions.length, where).toBeLessThanOrEqual(3);
      for (const a of rule.actions) expect(actionIds.has(a), `${where} → ${a}`).toBe(true);
    }
  });

  it('only filter numeric symptom rules by known symptoms', () => {
    const symptoms = new Set<string>(SYMPTOMS);
    for (const i of config.indicators.filter((x) => x.kind === 'number')) {
      for (const r of i.rules.filter((x) => x.withSymptoms && x.categories)) {
        for (const c of r.categories ?? []) expect(symptoms.has(c), `${i.id} → ${c}`).toBe(true);
      }
    }
  });
});

describe('actions', () => {
  it('have unique ids, bilingual text and existing protocols', () => {
    expect(actionIds.size).toBe(actions.length);
    for (const a of actions) {
      expectI18n(a.text, a.id);
      expect(a.priority).toBeGreaterThan(0);
      if (a.protocol) expect(protocolIds.has(a.protocol), `${a.id} → ${a.protocol}`).toBe(true);
    }
  });

  it('include the ids the engine adds on its own', () => {
    for (const id of [
      'repeat-measurement',
      'record-reading',
      'notify-earth',
      'repeat-battery-2h',
    ]) {
      expect(actionIds.has(id), id).toBe(true);
    }
  });
});

describe('units', () => {
  it('every unit used by an indicator has a label in both languages', () => {
    for (const i of config.indicators) {
      expectI18n(units[i.unit], `unit ${i.unit} (${i.id})`);
    }
  });

  it('unitLabel translates and falls back to the unit id', () => {
    expect(unitLabel('bpm', 'es')).toBe('lpm');
    expect(unitLabel('bpm', 'en')).toBe('bpm');
    expect(unitLabel('steps', 'es')).toBe('pasos');
    expect(unitLabel('unknown-unit', 'es')).toBe('unknown-unit');
  });

  it('level reads well after a number in both languages', () => {
    expect(`4 ${unitLabel('level', 'es')}`).toBe('4 de 5');
    expect(`4 ${unitLabel('level', 'en')}`).toBe('4 of 5');
  });
});

describe('symptoms', () => {
  it('match SYMPTOMS one to one, in order, with bilingual names', () => {
    expect(symptoms.map((s) => s.id)).toEqual([...SYMPTOMS]);
    for (const s of symptoms) {
      expectI18n(s.name, `${s.id}.name`);
      if (s.description) expectI18n(s.description, `${s.id}.description`);
    }
  });

  it('can be looked up by id', () => {
    expect(symptomById('chest-pain')?.name.en).toBe('Chest pain');
    expect(symptomById('does-not-exist')).toBeUndefined();
  });
});

describe('guides', () => {
  it('exist for every indicator with bilingual tabs and sources', () => {
    for (const i of config.indicators) {
      expectI18n(i.guide.howToMeasure, `${i.id}.howToMeasure`);
      expectI18n(i.guide.whyItMatters, `${i.id}.whyItMatters`);
      expectI18n(i.guide.whatToDo, `${i.id}.whatToDo`);
      expect(i.guide.sources.length, i.id).toBeGreaterThan(0);
    }
  });

  it('share the text between systolic and diastolic pressure', () => {
    const s = config.indicators.find((i) => i.id === 'systolic-bp')?.guide;
    const d = config.indicators.find((i) => i.id === 'diastolic-bp')?.guide;
    expect(d).toEqual(s);
  });

  it('cite NASA for the challenge indicators where it applies', () => {
    for (const id of [
      'heart-rate',
      'systolic-bp',
      'glucose',
      'body-temperature',
      'sleep',
      'mood',
    ]) {
      const sources = config.indicators.find((i) => i.id === id)?.guide.sources ?? [];
      expect(
        sources.some((s) => s.includes('nasa.gov')),
        id,
      ).toBe(true);
    }
  });
});

describe('glossary', () => {
  const UI_TERMS = [
    'baseline',
    'personal-range',
    'level-green',
    'level-amber',
    'level-red',
    'level-pending',
    'ecg',
    'blood-pressure',
    'respiratory-rate',
    'triage',
    'protocol',
    'emergency-packet',
    'communication-delay',
    'link-down',
    'check-in',
    'cognitive-battery',
  ];

  it('explains every indicator, zone and key UI term in es and en within 100 characters', () => {
    for (const id of [...indicatorIds, ...zoneIds, ...UI_TERMS]) {
      const entry = glossary[id];
      expectI18n(entry?.term, `glossary.${id}.term`);
      expectI18n(entry?.short, `glossary.${id}.short`);
      for (const lang of ['es', 'en'] as const) {
        const short = entry?.short[lang] ?? '';
        expect([...short].length, `glossary.${id}.short.${lang}`).toBeLessThanOrEqual(100);
      }
    }
  });

  it('has bilingual texts in every entry, unit hints included', () => {
    for (const [id, entry] of Object.entries(glossary)) {
      expectI18n(entry.term, `glossary.${id}.term`);
      expectI18n(entry.short, `glossary.${id}.short`);
      for (const lang of ['es', 'en'] as const) {
        expect([...entry.short[lang]].length, `glossary.${id}.short.${lang}`).toBeLessThanOrEqual(
          100,
        );
      }
      if (entry.unitHint) expectI18n(entry.unitHint, `glossary.${id}.unitHint`);
    }
  });

  it('gives a unit hint to every indicator with a numeric unit', () => {
    for (const i of config.indicators) {
      if (i.kind === 'number') expectI18n(glossary[i.id]?.unitHint, `glossary.${i.id}.unitHint`);
    }
  });

  it('explainTerm resolves one language and misses unknown ids', () => {
    expect(explainTerm('systolic-bp', 'es')).toEqual({
      term: glossary['systolic-bp']?.term.es,
      short: glossary['systolic-bp']?.short.es,
      unitHint: glossary['systolic-bp']?.unitHint?.es,
    });
    expect(explainTerm('vitals', 'en')).toEqual({
      term: 'Vital signs',
      short: glossary.vitals?.short.en,
    });
    expect(explainTerm('does-not-exist', 'es')).toBeUndefined();
    expect(explainTerm('toString', 'en')).toBeUndefined();
  });
});

describe('environments', () => {
  it('use the canonical ids and valid delays', () => {
    expect([...environmentIds].sort()).toEqual(
      [
        'launch',
        'station',
        'transit',
        'lunar-orbit',
        'moon',
        'mars-orbit',
        'mars',
        'rover',
        'reentry',
      ].sort(),
    );
    for (const e of config.environments) {
      expectI18n(e.name, e.id);
      expect(e.delayMin).toBeLessThanOrEqual(e.delayMax);
      expect(e.gravity).toBeGreaterThanOrEqual(0);
      for (const d of e.destinations ?? []) {
        expectI18n(d.name, `${e.id}.${d.id}`);
        expect(d.id).toMatch(/^[a-z0-9]+(-[a-z0-9]+)*$/);
        expect(d.durationDays).toBeGreaterThan(0);
      }
    }
  });

  it('explain what they do to the body and what HAVEN watches', () => {
    for (const e of config.environments) {
      expect(e.description, e.id).toBeDefined();
      if (e.description) expectI18n(e.description, `${e.id}.description`);
      expect(e.watch?.length, e.id).toBeGreaterThan(0);
      for (const w of e.watch ?? []) expectI18n(w, `${e.id}.watch`);
    }
  });
});

describe('mission templates', () => {
  it('use known environments, whole days and start with launch and end with reentry', () => {
    expect(missionTemplates.length).toBeGreaterThan(0);
    for (const t of missionTemplates) {
      expectI18n(t.name, t.id);
      expectI18n(t.description, t.id);
      expectI18n(t.summary, t.id);
      expectI18n(t.basedOn, t.id);
      expect(t.sourceUrl, t.id).toMatch(/^https:\/\/(www\.nasa\.gov|ntrs\.nasa\.gov)\//);
      expect(t.phases.at(0)?.environment, t.id).toBe('launch');
      expect(t.phases.at(-1)?.environment, t.id).toBe('reentry');
      for (const p of t.phases) {
        expect(environmentIds.has(p.environment), `${t.id} → ${p.environment}`).toBe(true);
        expect(Number.isInteger(p.days) && p.days > 0, `${t.id} → ${p.days}`).toBe(true);
        if (p.label) expectI18n(p.label, `${t.id}.label`);
      }
    }
  });

  it('phaseAt finds the phase of a day, clamped to the plan', () => {
    const phases = [
      { environment: 'launch', days: 1 },
      { environment: 'transit', days: 4 },
      { environment: 'moon', days: 7 },
    ];
    expect(missionDays(phases)).toBe(12);
    expect(phaseAt(phases, 1)).toMatchObject({ index: 0, startDay: 1, endDay: 1 });
    expect(phaseAt(phases, 2)).toMatchObject({ index: 1, startDay: 2, endDay: 5 });
    expect(phaseAt(phases, 5)?.index).toBe(1);
    expect(phaseAt(phases, 6)).toMatchObject({ index: 2, startDay: 6, endDay: 12 });
    expect(phaseAt(phases, 0)?.index).toBe(0);
    expect(phaseAt(phases, 40)?.index).toBe(2);
    expect(phaseAt([], 3)).toBeUndefined();
  });

  it('phaseDelay keeps the phase delay inside the environment range', () => {
    const transit = { delayMin: 0.02, delayMax: 22 };
    expect(phaseDelay({ environment: 'transit', days: 4, delayMin: 0.02 }, transit)).toBe(0.02);
    expect(phaseDelay({ environment: 'transit', days: 200, delayMin: 11 }, transit)).toBe(11);
    expect(phaseDelay({ environment: 'transit', days: 1, delayMin: 90 }, transit)).toBe(22);
    expect(phaseDelay({ environment: 'transit', days: 1 }, transit)).toBe(0.02);
  });
});

describe('protocols', () => {
  it('include the canonical ids', () => {
    for (const id of [
      'chest-pain',
      'radiation-shelter',
      'hypoglycemia',
      'fever',
      'cabin-atmosphere',
      'psychological-support',
    ]) {
      expect(protocolIds.has(id), id).toBe(true);
    }
  });

  it('have unique step ids and resolvable start, next and options', () => {
    for (const p of config.protocols) {
      expectI18n(p.name, p.id);
      const ids = p.steps.map((s) => s.id);
      expect(new Set(ids).size, p.id).toBe(ids.length);
      const known = new Set(ids);
      expect(known.has(p.start), `${p.id}.start`).toBe(true);
      expect(p.steps.length, p.id).toBeGreaterThanOrEqual(3);
      for (const s of p.steps) {
        expectI18n(s.text, `${p.id}.${s.id}`);
        if (s.audio) expectI18n(s.audio, `${p.id}.${s.id}.audio`);
        if (s.next) expect(known.has(s.next), `${p.id}.${s.id} → ${s.next}`).toBe(true);
        for (const o of s.options ?? []) {
          expectI18n(o.text, `${p.id}.${s.id}.option`);
          expect(known.has(o.next), `${p.id}.${s.id} → ${o.next}`).toBe(true);
        }
        for (const env of s.onlyIn ?? []) expect(environmentIds.has(env), env).toBe(true);
        if (s.seconds !== undefined) expect(s.seconds).toBeGreaterThan(0);
      }
    }
  });

  it('chest pain has microgravity and surface variants, CPR timers and ends in a packet', () => {
    const p = config.protocols.find((x) => x.id === 'chest-pain');
    const steps = p?.steps ?? [];
    expect(steps.some((s) => s.onlyIn?.includes('transit'))).toBe(true);
    expect(steps.some((s) => s.onlyIn?.includes('mars'))).toBe(true);
    expect(steps.find((s) => s.id === 'cpr-compressions')?.seconds).toBe(120);
    expect(steps.some((s) => s.id === 'earth-packet')).toBe(true);
  });
});

describe('scenarios', () => {
  type WithCategorical = Scenario & {
    categorical?: { indicator: string; points: [number, string][] }[];
  };

  it('have unique ids and include the canonical ones', () => {
    const ids = scenarios.map((e) => e.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(ids.sort()).toEqual([
      'cabin-atmosphere',
      'nominal',
      'sleep-mood',
      'solar-storm',
      'video',
    ]);
  });

  it('use existing indicators, ordered points within the duration and valid zones', () => {
    for (const s of scenarios as WithCategorical[]) {
      expectI18n(s.name, s.id);
      expect(s.sources.length, s.id).toBeGreaterThan(0);
      expect(s.durationMin, s.id).toBeGreaterThan(0);
      if (s.id !== 'nominal') expect(s.durationMin, s.id).toBeLessThanOrEqual(10);
      for (const serie of s.series) {
        expect(indicatorIds.has(serie.indicator), `${s.id} → ${serie.indicator}`).toBe(true);
        expect(config.indicators.find((i) => i.id === serie.indicator)?.kind).toBe('number');
        let last = -1;
        for (const [minute, value] of serie.points) {
          expect(minute, `${s.id}.${serie.indicator}`).toBeGreaterThanOrEqual(last);
          expect(minute).toBeLessThanOrEqual(s.durationMin);
          expect(Number.isFinite(value)).toBe(true);
          last = minute;
        }
      }
      for (const c of s.categorical ?? []) {
        if (c.indicator === SYMPTOM_INDICATOR) {
          for (const [, v] of c.points)
            expect((SYMPTOMS as readonly string[]).includes(v), v).toBe(true);
        } else {
          expect(config.indicators.find((i) => i.id === c.indicator)?.kind, c.indicator).toBe(
            'category',
          );
        }
      }
      for (const e of s.expected) {
        expect(zoneIds.has(e.zone), `${s.id} → ${e.zone}`).toBe(true);
        expect(['green', 'amber', 'red', 'pending']).toContain(e.level);
      }
    }
  });

  it('only emit watch messages with the contract payloads', () => {
    for (const s of scenarios) {
      for (const e of s.events) {
        expect(['emergency', 'monitor', 'mood']).toContain(e.message);
        const p = e.payload as Record<string, unknown>;
        expect('takenAt' in p, `${s.id} @${e.minute}`).toBe(true);
        if (e.message === 'emergency') {
          expect(['button', 'fall', 'heartRate', 'rhythm', 'spo2']).toContain(p.origin);
        }
        if (e.message === 'monitor') expect(typeof p.heartRate).toBe('number');
      }
    }
  });

  it('the video scenario fires the emergency and feeds the monitor', () => {
    const v = scenarios.find((s) => s.id === 'video');
    expect(v?.events.some((e) => e.message === 'emergency')).toBe(true);
    expect(v?.events.filter((e) => e.message === 'monitor').length).toBeGreaterThan(5);
    expect(v?.expected).toContainEqual({ zone: 'vitals', level: 'red' });
  });
});

describe('product copy (EQUIPOS.md, «Producto real»)', () => {
  it('no product config text mentions demo or simulation', () => {
    const banned =
      /\b(demo|demos|simulad[oa]s?|simulaci[oó]n|simulated?|simulation|guionizad[oa])\b/i;
    const files: Record<string, unknown> = {
      config,
      symptoms,
      units,
      glossary,
    };
    for (const [name, data] of Object.entries(files)) {
      const hit = JSON.stringify(data).match(banned);
      expect(hit?.[0], `${name}: «${hit?.[0]}»`).toBeUndefined();
    }
  });
});

describe('copy that must not depend on missing features', () => {
  it('protocol steps never refer to a drawing or illustration', () => {
    const banned = /dibujo|ilustraci[oó]n|drawing|illustration|as shown|picture/i;
    for (const p of config.protocols) {
      for (const st of p.steps) {
        for (const t of [st.text, st.audio, ...(st.options ?? []).map((o) => o.text)]) {
          if (!t) continue;
          expect(t.es, `${p.id}.${st.id}`).not.toMatch(banned);
          expect(t.en, `${p.id}.${st.id}`).not.toMatch(banned);
        }
      }
    }
  });

  it('guide sources are language-neutral citations', () => {
    const spanish = /\b(guía|Manual MSD|OMS|y|de la|según)\b/;
    for (const i of config.indicators) {
      for (const src of i.guide.sources) expect(src, i.id).not.toMatch(spanish);
    }
  });
});

describe('rebaseConfig', () => {
  const full = loadConfig({ includeExtras: true });
  const old = {
    ...full,
    version: '1.0.1-earth.1',
    zones: [{ ...full.zones[0], id: 'heart', indicators: ['heart-rate', 'hrv'] }],
    indicators: full.indicators
      .filter((i) => i.id !== 'hydration')
      .map((i) => (i.id === 'heart-rate' ? { ...i, green: [55, 95] as [number, number] } : i)),
  };
  const rebased = rebaseConfig(config, old);

  it('keeps the current zones and visible indicators', () => {
    expect(rebased.zones).toEqual(config.zones);
    expect(rebased.indicators.map((i) => i.id)).toEqual(config.indicators.map((i) => i.id));
    expect(rebased.indicators.some((i) => EXTRA_INDICATORS.includes(i.id))).toBe(false);
  });

  it('applies the received thresholds and version', () => {
    expect(rebased.version).toBe('1.0.1-earth.1');
    expect(rebased.indicators.find((i) => i.id === 'heart-rate')?.green).toEqual([55, 95]);
    expect(rebased.indicators.find((i) => i.id === 'hydration')).toEqual(
      config.indicators.find((i) => i.id === 'hydration'),
    );
  });

  it('ignores malformed input', () => {
    expect(rebaseConfig(config, null)).toBe(config);
    expect(rebaseConfig(config, { indicators: 'x' })).toBe(config);
    const bad = rebaseConfig(config, {
      indicators: [{ id: 'heart-rate', kind: 'number', green: [1] }],
    });
    expect(bad.indicators.find((i) => i.id === 'heart-rate')?.green).toEqual(
      config.indicators.find((i) => i.id === 'heart-rate')?.green,
    );
  });
});
