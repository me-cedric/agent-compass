// @ts-check

import eslint from '@eslint/js';
import tanstackQueryPlugin from '@tanstack/eslint-plugin-query';
import eslintPluginImport from 'eslint-plugin-import';
import eslintPluginPrettierRecommended from 'eslint-plugin-prettier/recommended';
import reactPlugin from 'eslint-plugin-react';
import reactHooks from 'eslint-plugin-react-hooks';
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
  // Prettier integration (must be the last extend/plugin to disable all formatting rules)
  eslintPluginPrettierRecommended,
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
      react: reactPlugin,
      'react-hooks': reactHooks,
      'react-native': reactNative,
      'react-you-might-not-need-an-effect': reactYouMightNotNeedAnEffect,
      import: eslintPluginImport,
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
      // Base React Rules
      ...reactPlugin.configs.recommended.rules,
      ...reactHooks.configs.recommended.rules,
      ...reactNative.configs.all.rules,
      ...reactYouMightNotNeedAnEffect.configs.recommended.rules,
      // AJOUTÉ : TanStack Query Rules
      ...tanstackQueryPlugin.configs.recommended.rules,

      // Custom React / React Native Rules
      'react/react-in-jsx-scope': 'off', // Not needed since React 17+ (JSX Transform)
      'react-native/no-unused-styles': 'off',
      'react/self-closing-comp': 'error',
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
      'import/order': [
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
    },
    settings: {
      react: {
        version: 'detect',
      },
      'import/resolver': {
        alias: {
          map: [
            ['@', './src'],
            ['@app', './app'],
            ['@tests', './__tests__'],
          ],
          extensions: ['.ts', '.tsx', '.js', '.jsx', '.json'],
        },
      },
    },
  },
);
