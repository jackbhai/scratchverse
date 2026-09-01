import js from '@eslint/js';
import globals from 'globals';

export default [
  js.configs.recommended,
  {
    files: ['scripts/*.mjs'],
    languageOptions: {
      ecmaVersion: 2023,
      sourceType: 'commonjs',
      globals: { ...globals.node, ...globals.es2021 },
      parserOptions: { ecmaFeatures: { jsx: true } },
    },
    rules: { 'no-undef': 'error', 'no-unused-vars': 'off', 'no-empty': 'off' },
  },
  {
    files: ['src/**/*.{js,jsx}', 'scripts/*.mjs'],
    languageOptions: {
      ecmaVersion: 2023,
      sourceType: 'module',
      globals: { ...globals.browser, ...globals.es2021 },
      parserOptions: { ecmaFeatures: { jsx: true } },
    },
    rules: {
      'no-undef': 'error',
      'no-unused-vars': ['warn', { args: 'none', varsIgnorePattern: '^_|React$' }],
      'no-empty': ['warn', { allowEmptyCatch: true }],
      'no-useless-assignment': 'off',
      'no-prototype-builtins': 'off',
      'no-fallthrough': 'off',
    },
  },
];
