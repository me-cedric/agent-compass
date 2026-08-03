// @ts-check

import eslintReact from '@eslint-react/eslint-plugin';
import eslint from '@eslint/js';
import tanstackQueryPlugin from '@tanstack/eslint-plugin-query';
import eslintConfigPrettier from 'eslint-config-prettier';
import { createTypeScriptImportResolver } from 'eslint-import-resolver-typescript';
import { createNodeResolver, importX } from 'eslint-plugin-import-x';
import reactNative from 'eslint-plugin-react-native';
import reactYouMightNotNeedAnEffect from 'eslint-plugin-react-you-might-not-need-an-effect';
import globals from 'globals';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  {
    ignores: [
      '**/metro.config.js',
      'commitlint.config.js',
      'eslint.config.mjs',
      'jest.base.config.js',
      '**/dist/**',
      '**/build/**',
      '**/coverage/**',
      '**/node_modules/**',
      '**/.expo/**',
      '**/babel.config.js',
      '**.md',
      '**/jest.config.js',
      '**/jest.setup.js',
      '**/android/**',
      '**/ios/**',
      '**/app.old/**',
      '**/scripts/**.cjs',
      '**/plugins/**'
    ],
  },
  // Base JS rules
  eslint.configs.recommended,
  // Base TS rules (Recommended + Type Checked)
  ...tseslint.configs.recommendedTypeChecked,
  eslintReact.configs['recommended-typescript'],
  eslintReact.configs['disable-dom'],
  eslintReact.configs['disable-web-api'],
  importX.flatConfigs.recommended,
  eslintConfigPrettier,
  {
    languageOptions: {
      globals: {
        ...globals.es2021,
        ...globals.node,
      },
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
    rules: {
      // Warning: Disabling or loosening these rules reduces type safety. Use with caution.
      '@typescript-eslint/no-explicit-any': 'off',
      '@typescript-eslint/no-floating-promises': 'error',
      '@typescript-eslint/no-unsafe-assignment': 'error',
      '@typescript-eslint/no-unsafe-call': 'error',
      '@typescript-eslint/no-unsafe-member-access': 'error',
      '@typescript-eslint/no-unsafe-return': 'error',
      'no-console': ['warn', { allow: ['warn', 'error'] }],
    },
  },
  // --- React Native / TSX / JSX Configuration ---
  {
    plugins: {
      'react-native': reactNative,
      'react-you-might-not-need-an-effect': reactYouMightNotNeedAnEffect,
      '@tanstack/query': tanstackQueryPlugin,
    },
    languageOptions: {
      globals: {
        ...globals.browser,
        ...globals.es2021,
        ...globals.jest,
      },
      parserOptions: {
        tsconfigRootDir: import.meta.dirname,
        ecmaFeatures: {
          jsx: true,
        },
      },
    },
    rules: {
      ...reactNative.configs.all.rules,
      ...reactYouMightNotNeedAnEffect.configs.recommended.rules,
      // AJOUTÉ : TanStack Query Rules
      ...tanstackQueryPlugin.configs.recommended.rules,

      // Custom React / React Native Rules
      'react-native/no-unused-styles': 'off',
      eqeqeq: ['error', 'always'],
      'react-native/no-raw-text': [
        'error',
        {
          skip: ['ThemedText'],
        },
      ],
      // Custom TypeScript Rules
      '@typescript-eslint/no-unused-vars': 'error',
      '@typescript-eslint/no-unnecessary-type-assertion': 'error',
      '@typescript-eslint/no-unnecessary-condition': 'error',
      '@typescript-eslint/no-misused-promises': 'error',
      '@typescript-eslint/consistent-type-definitions': ['error', 'interface'],

      // Import Order Rules
      'import-x/order': [
        'error',
        {
          groups: [
            'builtin',
            'external',
            'internal',
            ['parent', 'sibling', 'index'],
          ],
          pathGroups: [
            {
              pattern: 'react',
              group: 'external',
              position: 'before',
            },
            {
              pattern: 'react-native',
              group: 'external',
              position: 'before',
            },
            {
              pattern: '@/**',
              group: 'internal',
              position: 'after',
            },
          ],
          pathGroupsExcludedImportTypes: ['react', 'react-native'],
          'newlines-between': 'always',
          alphabetize: {
            order: 'asc',
            caseInsensitive: true,
          },
        },
      ],
      'import-x/no-unresolved': 'error',
      'import-x/no-nodejs-modules': 'warn',
    },
    settings: {
      'import-x/resolver-next': [
        createTypeScriptImportResolver(),
        createNodeResolver(),
      ],
    },
  },
);
