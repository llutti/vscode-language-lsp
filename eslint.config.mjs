import js from '@eslint/js';
import { defineConfig, globalIgnores } from 'eslint/config';
import globals from 'globals';
import tseslint from 'typescript-eslint';

export default defineConfig([
  globalIgnores([
    '**/node_modules/**',
    '**/dist/**',
    '**/out/**',
    '**/.lsp-debug/**',
    '**/*.d.ts',
    '**/*.js.map',
    'v1/**'
  ]),
  {
    files: ['scripts/**/*.mjs'],
    languageOptions: {
      globals: {
        ...globals.node
      }
    },
    ...js.configs.recommended,
    rules: {
      ...js.configs.recommended.rules,
      'no-console': 'off'
    }
  },
  ...tseslint.configs.recommended.map((config) => ({
    ...config,
    files: ['packages/**/*.{ts,mts,cts}'],
    languageOptions: {
      ...(config.languageOptions ?? {}),
      globals: {
        ...globals.node,
        ...(config.languageOptions?.globals ?? {})
      }
    }
  })),
  {
    files: ['packages/**/*.{ts,mts,cts}', 'scripts/**/*.{ts,mts,cts}'],
    rules: {
      semi: 'error',
      quotes: ['warn', 'single', { avoidEscape: true }],
      eqeqeq: ['warn', 'always'],
      'no-self-assign': 'off',
      'new-parens': 'warn',
      'no-cond-assign': ['warn', 'always'],

      '@typescript-eslint/no-empty-function': 'warn',
      '@typescript-eslint/no-explicit-any': 'warn',
      '@typescript-eslint/no-unused-expressions': ['warn', {
        allowShortCircuit: true,
        allowTernary: true,
        allowTaggedTemplates: true,
      }],
      '@typescript-eslint/prefer-for-of': 'off',
      '@typescript-eslint/no-inferrable-types': 'off',
      '@typescript-eslint/consistent-type-definitions': 'off',
      '@typescript-eslint/consistent-indexed-object-style': 'off', // ['warn', 'index-signature'],


      '@typescript-eslint/no-extra-non-null-assertion': 'off',
      'prefer-const': 'warn',
      '@typescript-eslint/no-unused-vars': [
        'warn',
        {
          argsIgnorePattern: '^_',
          varsIgnorePattern: '^_',
          caughtErrorsIgnorePattern: '^_'
        }
      ]
    }
  },
  {
    files: ['packages/**/test/**/*.ts'],
    rules: {
      '@typescript-eslint/no-empty-function': 'off',
    }
  }
]);
