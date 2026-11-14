export const MISSION_CODE_LENGTH = 6;

export const MISSION_CODE_PATTERN = /^[A-Z0-9]{6}$/;

export const CODE_ALPHABET = 'ACDEFGHJKMNPQRTUVWXY34679';

export function generateMissionCode(random: () => number = Math.random): string {
  let code = '';
  for (let i = 0; i < MISSION_CODE_LENGTH; i++) {
    const index = Math.min(CODE_ALPHABET.length - 1, Math.floor(random() * CODE_ALPHABET.length));
    code += CODE_ALPHABET[index];
  }
  return code;
}

export function generateUniqueMissionCode(
  taken: Iterable<string>,
  random: () => number = Math.random,
): string {
  const used = new Set(taken);
  for (let attempt = 0; attempt < 50; attempt++) {
    const code = generateMissionCode(random);
    if (!used.has(code)) return code;
  }
  for (const a of CODE_ALPHABET) {
    const code = `${generateMissionCode(random).slice(0, MISSION_CODE_LENGTH - 1)}${a}`;
    if (!used.has(code)) return code;
  }
  return generateMissionCode(random);
}

export function normalizeMissionCode(input: string): string {
  return input
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '')
    .slice(0, MISSION_CODE_LENGTH);
}

export function isValidMissionCode(code: string): boolean {
  return MISSION_CODE_PATTERN.test(code);
}
