import type { I18n, Mission } from '../contracts';

/** Demo crew member: the `Mission.crew` entry plus a display role (not part of the contract). */
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

/** Display role of a demo crew member, or undefined for an unknown id. */
export function crewRole(id: string): I18n | undefined {
  return DEMO_CREW.find((c) => c.id === id)?.role;
}

/** Commander of the demo crew. */
export const DEMO_COMMANDER = 'elena-vega';
/** Mission control contact in the demo (not a crew member, no readings). */
export const DEMO_MISSION_CONTROL = { id: 'lucia-morales', name: 'Lucía Morales' };

/** Ares-1: transit to Mars, day 142 of 540, 11 min one-way delay. */
export const DEMO_MISSION: Mission = {
  code: 'ARES01',
  environment: 'transit',
  day: 142,
  currentDelayMin: 11,
  linkDown: false,
  crew: DEMO_CREW,
};
export const DEMO_MISSION_NAME = 'Ares-1';

/** Habitat modules: nominal values (the cabin-atmosphere scenario raises the rest module). */
export const HABITAT_MODULES = {
  rest: { id: 'rest', co2MmHg: 2.3, noiseDb: 52 },
  lab: { id: 'lab', co2MmHg: 1.8, noiseDb: 48 },
} as const;
