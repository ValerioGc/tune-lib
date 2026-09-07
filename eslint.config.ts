import js from '@eslint/js';
import prettier from '@vue/eslint-config-prettier';
import { defineConfigWithVueTs, vueTsConfigs } from '@vue/eslint-config-typescript';
import pluginVue from 'eslint-plugin-vue';
import globals from 'globals';

export default defineConfigWithVueTs(
  {
    name: 'app/files-to-lint',
    files: ['**/*.{ts,mts,vue}'],
  },

  {
    name: 'app/files-to-ignore',
    ignores: ['dist/**', 'coverage/**', 'src-tauri/**', 'node_modules/**'],
  },

  js.configs.recommended,
  pluginVue.configs['flat/recommended'],
  vueTsConfigs.recommended,
  // Last of the shared configurations: it switches off everything Prettier already decides,
  // so no rule here argues with the formatter over a line break or a semicolon.
  prettier,

  {
    name: 'app/rules',
    rules: {
      'no-console': ['warn', { allow: ['warn', 'error'] }],
      'no-debugger': 'error',
      'no-duplicate-imports': 'error',
      eqeqeq: ['error', 'always'],
      'prefer-const': 'error',
      'no-var': 'error',
      curly: ['error', 'all'],
      'nonblock-statement-body-position': ['error', 'below'],
      complexity: ['error', 15],
      'max-depth': ['error', 4],
      'max-params': ['error', 5],
      '@typescript-eslint/no-explicit-any': 'error',
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_', ignoreRestSiblings: true },
      ],
      '@typescript-eslint/consistent-type-imports': 'error',
      'vue/multi-word-component-names': ['error', { ignores: ['App'] }],
      'vue/component-api-style': ['error', ['script-setup']],
      'vue/define-macros-order': 'error',
      // Keep a readable breathing line inside multiline Vue script/style blocks.
      'vue/block-tag-newline': [
        'error',
        {
          singleline: 'ignore',
          multiline: 'ignore',
          blocks: {
            script: { singleline: 'ignore', multiline: 'always', maxEmptyLines: 1 },
            style: { singleline: 'ignore', multiline: 'always', maxEmptyLines: 1 },
          },
        },
      ],
      'vue/no-unused-refs': 'error',
    },
  },

  {
    // Build and release helpers: Node scripts in CommonJS, not browser code.
    name: 'app/scripts',
    files: ['scripts/**/*.cjs'],
    languageOptions: {
      sourceType: 'commonjs',
      globals: globals.node,
    },
    rules: {
      '@typescript-eslint/no-require-imports': 'off',
      'no-console': 'off',
    },
  },

  {
    // The browser suite: Gherkin steps and their hooks, run by Cucumber under Node. Part of
    // it is serialized and run inside the page instead, so it speaks both languages.
    name: 'app/e2e',
    files: ['src/tests/e2e/**/*.js'],
    languageOptions: {
      globals: { ...globals.node, ...globals.browser },
    },
  },

  {
    name: 'app/tests',
    files: ['**/*.spec.ts'],
    rules: {
      'max-params': 'off',
    },
  },
);
