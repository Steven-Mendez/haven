import type { I18n, Mission } from '../contracts';

export type DemoCrewMember = Mission['crew'][number] & { role: I18n };

export const DEMO_CREW: DemoCrewMember[] = [
  {
    id: 'elena-vega',
    name: 'Elena Vega',
    hasWatch: false,
    role: { es: 'Comandante', en: 'Commander' },
  },
  {
    id: 'mateo-rios',
    name: 'Mateo Ríos',
    hasWatch: false,
    role: { es: 'Ingeniero de vuelo', en: 'Flight engineer' },
  },
  {
    id: 'samira-chen',
    name: 'Samira Chen',
    hasWatch: false,
    role: {
      es: 'Especialista de misión y oficial médica de a bordo (CMO)',
      en: 'Mission specialist and crew medical officer (CMO)',
    },
  },
];

export function crewRole(id: string): I18n | undefined {
  return DEMO_CREW.find((c) => c.id === id)?.role;
}

export const DEMO_COMMANDER = 'elena-vega';
export const DEMO_MISSION_CONTROL = { id: 'lucia-morales', name: 'Lucía Morales' };

export const DEMO_MISSION: Mission = {
  code: 'ARES01',
  environment: 'transit',
  day: 142,
  currentDelayMin: 11,
  linkDown: false,
  crew: DEMO_CREW,
};
export const DEMO_MISSION_NAME = 'Ares-1';

export const HABITAT_MODULES = {
  rest: { id: 'rest', co2MmHg: 2.3, noiseDb: 52 },
  lab: { id: 'lab', co2MmHg: 1.8, noiseDb: 48 },
} as const;
