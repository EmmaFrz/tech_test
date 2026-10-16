import { fileURLToPath } from 'node:url';

import js from '@eslint/js';
import nextPlugin from '@next/eslint-plugin-next';
import prettier from 'eslint-config-prettier';
import importPlugin from 'eslint-plugin-import';
import jsxA11y from 'eslint-plugin-jsx-a11y';
import reactHooks from 'eslint-plugin-react-hooks';
import globals from 'globals';
import tseslint from 'typescript-eslint';

import { layerZones } from './config/eslint/layers.mjs';

const tsFiles = ['**/*.{ts,tsx}'];
const relativeImportRestriction = {
  group: ['../../**'],
  message: 'Use @/ or @shared/ instead of climbing multiple directories.',
};

export default tseslint.config(
  {
    ignores: [
      'agents/**',
      '.agents/**',
      '.codex/**',
      '.claude/**',
      '.cursor/**',
      '.local/**',
      '**/node_modules/**',
      '**/dist/**',
      '.next/**',
      'next-env.d.ts',
      'coverage/**',
      'cypress/videos/**',
      'cypress/screenshots/**',
    ],
  },
  js.configs.recommended,
  {
    files: ['**/*.mjs'],
    languageOptions: { globals: globals.node },
  },
  {
    files: tsFiles,
    extends: [...tseslint.configs.recommendedTypeChecked],
    languageOptions: {
      parserOptions: {
        projectService: true,
        tsconfigRootDir: fileURLToPath(new URL('.', import.meta.url)),
      },
      globals: { ...globals.browser, ...globals.node },
    },
    plugins: {
      import: importPlugin,
      'react-hooks': reactHooks,
      'jsx-a11y': jsxA11y,
    },
    settings: {
      'import/resolver': {
        typescript: {
          project: './tsconfig.json',
        },
      },
    },
    rules: {
      ...reactHooks.configs.recommended.rules,
      ...jsxA11y.configs.recommended.rules,
      '@typescript-eslint/no-explicit-any': 'error',
      '@typescript-eslint/no-non-null-assertion': 'error',
      '@typescript-eslint/consistent-type-imports': 'error',
      '@typescript-eslint/explicit-module-boundary-types': 'error',
      '@typescript-eslint/switch-exhaustiveness-check': 'error',
      '@typescript-eslint/no-floating-promises': 'error',
      'no-console': 'error',
      'no-debugger': 'error',
      eqeqeq: ['error', 'always'],
      curly: ['error', 'all'],
      'prefer-const': 'error',
      'no-nested-ternary': 'error',
      'no-warning-comments': ['error', { terms: ['todo', 'fixme'], location: 'anywhere' }],
      'no-restricted-syntax': [
        'error',
        {
          selector: 'TSEnumDeclaration',
          message: 'Use a string literal union instead of an enum.',
        },
      ],
      'no-restricted-imports': ['error', { patterns: [relativeImportRestriction] }],
      'import/no-default-export': 'error',
      'import/no-restricted-paths': [
        'error',
        { basePath: fileURLToPath(new URL('.', import.meta.url)), zones: layerZones },
      ],
      'import/order': [
        'error',
        {
          groups: ['builtin', 'external', 'type', 'internal', 'parent', 'sibling', 'index'],
          pathGroups: [
            { pattern: '@/**', group: 'internal' },
            { pattern: '@shared/**', group: 'internal' },
            { pattern: '**/*.css', group: 'index', position: 'after' },
          ],
          pathGroupsExcludedImportTypes: ['builtin'],
          distinctGroup: true,
          'newlines-between': 'always',
          alphabetize: { order: 'asc', caseInsensitive: true },
        },
      ],
    },
  },
  { files: ['src/**/*.{ts,tsx}'], ...nextPlugin.configs['core-web-vitals'] },
  {
    files: ['src/{domain,data,lib}/**/*.{ts,tsx}', 'shared/**/*.ts', 'mock-server/**/*.ts'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            relativeImportRestriction,
            {
              group: ['react', 'react/**', 'react-dom', 'react-dom/**'],
              message: 'Keep this layer independent of React.',
            },
          ],
        },
      ],
    },
  },
  {
    files: ['*.config.ts', 'src/app/**/{page,layout,not-found,error}.tsx'],
    rules: { 'import/no-default-export': 'off' },
  },
  { files: ['src/lib/logger.ts'], rules: { 'no-console': 'off' } },
  { files: ['**/*.test.{ts,tsx}'], rules: { 'import/no-restricted-paths': 'off' } },
  prettier,
);
