import type { Config, Indicator, Reading, Rule } from '../contracts';

const t = (es: string, en = es) => ({ es, en });
const guide: Indicator['guide'] = {
  howToMeasure: t(''),
  whyItMatters: t(''),
  whatToDo: t(''),
  sources: [],
};

function indicator(p: Partial<Indicator> & Pick<Indicator, 'id' | 'zone' | 'unit'>): Indicator {
  return {
    name: t(p.id),
    suggestedByChallenge: true,
    kind: 'number',
    green: [0, 0],
    rules: [],
    source: 'test',
    guide,
    ...p,
  };
}

const rule = (r: Omit<Rule, 'explanation' | 'actions'> & { actions?: string[]; why?: string }) => {
  const { why, actions, ...rest } = r;
  return { ...rest, explanation: t(why ?? `${r.level}`), actions: actions ?? [] } as Rule;
};

export const TEST_CONFIG: Config = {
  version: 'test',
  environments: [
    {
      id: 'transit',
      name: t('Tránsito', 'Transit'),
      gravity: 0,
      delayMin: 4,
      delayMax: 22,
      blackouts: true,
      evacuation: false,
      dailyDoseMSv: 1.6,
    },
  ],
  protocols: [],
  zones: [
    {
      id: 'heart',
      name: t('Corazón'),
      purpose: t(''),
      indicators: ['heart-rate', 'systolic-bp', 'diastolic-bp', 'heart-rhythm'],
      dailyAction: { text: t('Presión'), minutes: 2, opens: 'systolic-bp' },
    },
    {
      id: 'lungs',
      name: t('Pulmones'),
      purpose: t(''),
      indicators: ['spo2', 'cabin-co2'],
      dailyAction: { text: t('SpO2'), minutes: 1, opens: 'spo2' },
    },
    {
      id: 'metabolism',
      name: t('Abdomen'),
      purpose: t(''),
      indicators: ['glucose'],
      dailyAction: { text: t('Glucosa'), minutes: 2, opens: 'glucose' },
    },
    {
      id: 'mind',
      name: t('Mente'),
      purpose: t(''),
      indicators: ['stress', 'mood'],
      dailyAction: { text: t('Bienestar'), minutes: 2, opens: 'wellbeing' },
    },
    {
      id: 'head',
      name: t('Cabeza'),
      purpose: t(''),
      indicators: ['reaction-time', 'pvt-lapses', 'working-memory'],
      dailyAction: { text: t('Batería'), minutes: 4, opens: 'cognition' },
    },
    {
      id: 'musculoskeletal',
      name: t('Huesos'),
      purpose: t(''),
      indicators: ['resistance-exercise'],
      dailyAction: { text: t('Ejercicio'), minutes: 45, opens: 'resistance-exercise' },
    },
    {
      id: 'skin',
      name: t('Piel'),
      purpose: t(''),
      indicators: ['solar-event'],
      dailyAction: { text: t('Refugio'), minutes: 1, opens: 'radiation-shelter' },
    },
  ],
  indicators: [
    indicator({
      id: 'heart-rate',
      zone: 'heart',
      unit: 'lpm',
      everyHours: 4,
      green: [60, 100],
      rules: [
        rule({ level: 'red', outside: [50, 120], withSymptoms: true, actions: ['chest-pain'] }),
        rule({ level: 'amber', outside: [50, 120] }),
      ],
    }),
    indicator({
      id: 'systolic-bp',
      zone: 'heart',
      unit: 'mmHg',
      everyHours: 24,
      green: [90, 129],
      rules: [
        rule({ level: 'red', outside: [90, 139], withSymptoms: true }),
        rule({
          level: 'amber',
          outside: [0, 139],
          why: 'stage-2',
          actions: ['repeat-bp', 'hydrate'],
        }),
        rule({ level: 'amber', baselineDeviation: 1.5, why: 'baseline' }),
      ],
    }),
    indicator({
      id: 'diastolic-bp',
      zone: 'heart',
      unit: 'mmHg',
      everyHours: 24,
      green: [60, 79],
      rules: [rule({ level: 'amber', outside: [0, 89], why: 'stage-2' })],
    }),
    indicator({
      id: 'heart-rhythm',
      zone: 'heart',
      unit: '',
      kind: 'category',
      everyHours: 24,
      rules: [rule({ level: 'red', categories: ['irregular'], why: 'irregular' })],
    }),
    indicator({
      id: 'spo2',
      zone: 'lungs',
      unit: '%',
      everyHours: 12,
      green: [95, 100],
      rules: [
        rule({ level: 'red', outside: [90, 100], why: 'hypoxia' }),
        rule({ level: 'amber', outside: [95, 100], sustainedMin: 10, why: 'low-sustained' }),
      ],
    }),
    indicator({
      id: 'cabin-co2',
      zone: 'lungs',
      unit: 'mmHg',
      everyHours: 1,
      green: [0, 3],
      rules: [rule({ level: 'amber', outside: [0, 3], why: 'co2' })],
      environmentOverrides: {
        mars: {
          green: [0, 2.5],
          rules: [rule({ level: 'amber', outside: [0, 2.5], why: 'co2-mars' })],
        },
      },
    }),
    indicator({
      id: 'glucose',
      zone: 'metabolism',
      unit: 'mg/dL',
      everyHours: 24,
      green: [70, 99],
      rules: [
        rule({ level: 'red', outside: [70, 1000], withSymptoms: true, why: 'hypo-symptoms' }),
        rule({ level: 'amber', outside: [70, 1000], why: 'hypo', actions: ['rule-15-15'] }),
        rule({ level: 'amber', outside: [0, 125], repetitions: 2, why: 'high-repeated' }),
      ],
    }),
    indicator({
      id: 'stress',
      zone: 'mind',
      unit: '1-5',
      everyHours: 24,
      green: [1, 3],
      rules: [rule({ level: 'amber', outside: [1, 3], repetitions: 3, why: 'stress-3' })],
    }),
    indicator({
      id: 'mood',
      zone: 'mind',
      unit: '1-5',
      everyHours: 24,
      green: [3, 5],
      rules: [rule({ level: 'amber', outside: [3, 5], repetitions: 3, why: 'mood-3' })],
    }),
    indicator({
      id: 'reaction-time',
      zone: 'head',
      unit: 'ms',
      everyHours: 24,
      green: [150, 400],
      rules: [
        rule({ level: 'amber', baselineDeviation: 1, why: 'slow', actions: ['repeat-battery-2h'] }),
      ],
    }),
    indicator({
      id: 'pvt-lapses',
      zone: 'head',
      unit: '',
      everyHours: 24,
      green: [0, 1],
      rules: [rule({ level: 'amber', outside: [0, 1], why: 'lapses' })],
    }),
    indicator({
      id: 'working-memory',
      zone: 'head',
      unit: 'level',
      everyHours: 24,
      green: [3, 5],
      rules: [],
    }),
    indicator({
      id: 'resistance-exercise',
      zone: 'musculoskeletal',
      unit: 'min',
      everyHours: 24,
      green: [45, 600],
      rules: [],
    }),
    indicator({
      id: 'solar-event',
      zone: 'skin',
      unit: 'S',
      everyHours: 1,
      green: [0, 0],
      rules: [rule({ level: 'red', outside: [0, 1], why: 'shelter', actions: ['go-to-shelter'] })],
    }),
  ],
};

export const NOW = new Date('2026-11-14T12:00:00.000Z');
let seq = 0;

export function reading(
  indicator: string,
  value: number | string,
  minutesAgo = 0,
  extra?: Partial<Reading>,
): Reading {
  seq++;
  return {
    id: `r${seq}`,
    indicator,
    value,
    unit: '',
    takenAt: new Date(NOW.getTime() - minutesAgo * 60_000).toISOString(),
    source: 'manual',
    simulated: false,
    crewMember: 'elena-vega',
    ...extra,
  };
}
