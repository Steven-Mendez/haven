import { defineConfig } from 'vitest/config';

// Unit tests for pure feature logic (`src/features/*/logic/*.test.ts`). Logic files must not import
// React Native, Expo or `@/shared`: only `@haven/core` and relative modules.
export default defineConfig({
  test: { include: ['src/**/logic/**/*.test.ts'], passWithNoTests: true },
});
