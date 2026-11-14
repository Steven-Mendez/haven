import type { I18n, Mission } from '@haven/core';

export type CrewOption = { id: string; name: string; hasWatch: boolean; role?: I18n };

export const CREW_NAME_MAX = 40;

export function crewFromApi(value: unknown): CrewOption[] {
  if (!Array.isArray(value)) return [];
  const crew: CrewOption[] = [];
  for (const item of value) {
    if (!item || typeof item !== 'object') continue;
    const m = item as Record<string, unknown>;
    if (typeof m.id !== 'string' || !m.id || crew.some((c) => c.id === m.id)) continue;
    const role = m.role as Record<string, unknown> | undefined;
    crew.push({
      id: m.id,
      name: typeof m.name === 'string' && m.name.trim() ? m.name.trim() : m.id,
      hasWatch: m.hasWatch === true,
      ...(role && typeof role.es === 'string' && typeof role.en === 'string'
        ? { role: { es: role.es, en: role.en } }
        : {}),
    });
  }
  return crew;
}

export function missionCrew(crew: CrewOption[]): Mission['crew'] {
  return crew.map(({ id, name, hasWatch }) => ({ id, name, hasWatch }));
}

export function cleanCrewName(input: string): string {
  return input.trim().replace(/\s+/g, ' ');
}

export function isValidCrewName(input: string): boolean {
  const name = cleanCrewName(input);
  return name.length >= 2 && name.length <= CREW_NAME_MAX;
}

export function crewIdFor(name: string, taken: string[]): string {
  const base =
    name
      .normalize('NFD')
      .replace(/[̀-ͯ]/g, '')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 40) || 'crew';
  let id = base;
  for (let n = 2; taken.includes(id); n++) id = `${base}-${n}`;
  return id;
}

export function withTypedCrewMember(
  crew: CrewOption[],
  input: string,
): { crew: CrewOption[]; id: string } {
  const name = cleanCrewName(input);
  const existing = crew.find((c) => c.id === crewIdFor(name, []));
  if (existing) return { crew, id: existing.id };
  const id = crewIdFor(
    name,
    crew.map((c) => c.id),
  );
  return { crew: [...crew, { id, name, hasWatch: false }], id };
}

export function mergeCrew(earth: CrewOption[], local: CrewOption[] | undefined): CrewOption[] {
  return [...earth, ...(local ?? []).filter((l) => !earth.some((e) => e.id === l.id))];
}
