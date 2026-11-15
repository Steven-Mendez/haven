// ESLint here checks one thing only: React Native accessibility.
// Formatting and every other lint rule belong to Biome (see /biome.json).
import tsParser from '@typescript-eslint/parser';
import reactNativeA11y from 'eslint-plugin-react-native-a11y';

export default [
  {
    files: ['src/**/*.{ts,tsx}', 'modules/**/*.{ts,tsx}'],
    languageOptions: {
      parser: tsParser,
      parserOptions: {
        ecmaFeatures: { jsx: true },
      },
    },
    linterOptions: {
      // Biome owns `biome-ignore`; ESLint should not complain about directives it does not use.
      reportUnusedDisableDirectives: 'off',
    },
    plugins: {
      'react-native-a11y': reactNativeA11y,
    },
    rules: {
      ...reactNativeA11y.configs.all.rules,
      // Demands a hint next to every accessibilityLabel. Hints are for controls whose
      // outcome the label does not already explain; on everything else they are noise.
      'react-native-a11y/has-accessibility-hint': 'off',
    },
  },
];
