// Mission code (closed decision 8: no accounts, a six-character code identifies the mission).
// Pure: no React, Expo or `@/shared`.

export const MISSION_CODE_LENGTH = 6;

/** Same rule as the Earth API (`POST /api/missions`): six uppercase letters or digits. */
export const MISSION_CODE_PATTERN = /^[A-Z0-9]{6}$/;

/**
 * Alphabet for generated codes: no 0/O, 1/I/L, 5/S, 2/Z, 8/B, so a code read aloud over a noisy
 * link or typed with gloves is not misread. Existing codes such as `ARES01` stay valid.
 */
export const CODE_ALPHABET = 'ACDEFGHJKMNPQRTUVWXY34679';

/** Generates a code with the given random source (`Math.random` by default; inject in tests). */
export function generateMissionCode(random: () => number = Math.random): string {
  let code = '';
  for (let i = 0; i < MISSION_CODE_LENGTH; i++) {
    const index = Math.min(CODE_ALPHABET.length - 1, Math.floor(random() * CODE_ALPHABET.length));
    code += CODE_ALPHABET[index];
  }
  return code;
}

/** Generates a code not present in `taken` (tries a few times, then accepts a collision-free suffix). */
export function generateUniqueMissionCode(
  taken: Iterable<string>,
  random: () => number = Math.random,
): string {
  const used = new Set(taken);
  for (let attempt = 0; attempt < 50; attempt++) {
    const code = generateMissionCode(random);
    if (!used.has(code)) return code;
  }
  // Practically unreachable (25^6 ≈ 244 M codes): walk the alphabet deterministically.
  for (const a of CODE_ALPHABET) {
    const code = `${generateMissionCode(random).slice(0, MISSION_CODE_LENGTH - 1)}${a}`;
    if (!used.has(code)) return code;
  }
  return generateMissionCode(random);
}

/** Normalizes user input: uppercase, without spaces, dashes or other symbols, max six characters. */
export function normalizeMissionCode(input: string): string {
  return input
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '')
    .slice(0, MISSION_CODE_LENGTH);
}

export function isValidMissionCode(code: string): boolean {
  return MISSION_CODE_PATTERN.test(code);
}
