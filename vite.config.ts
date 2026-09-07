/// <reference types="vitest/config" />
import { fileURLToPath, URL } from 'node:url';

import vue from '@vitejs/plugin-vue';
import { defineConfig } from 'vite';

import combineSelectors from 'postcss-combine-duplicated-selectors';
import purgecss from '@fullhuman/postcss-purgecss';
import cssnano from 'cssnano';

const DEV_SERVER_PORT = 1420;

export default defineConfig({
  plugins: [vue()],

  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
      '@tests': fileURLToPath(new URL('./src/tests', import.meta.url)),
    },
  },

  css: {
    preprocessorOptions: {
      scss: {
        loadPaths: [fileURLToPath(new URL('./src/styles', import.meta.url))],
        additionalData:
          '@use "global/vars" as *;\n@use "global/mixins" as *;\n@use "global/placeholders" as *;\n',
      },
    },
    postcss: {
      plugins: [
        combineSelectors({ removeDuplicatedProperties: true }),
        purgecss({
          content: ['./public/**/*.html', './src/**/*.vue', './src/**/*.ts', './src/**/*.scss'],
          safelist: {
            standard: [/^v-/, /^dark/],
          },
          defaultExtractor: (content) => content.match(/[\w-/:]+(?<!:)/g) ?? [],
        }),
        cssnano({ preset: 'default' }),
      ],
    },
  },

  clearScreen: false,
  envPrefix: ['VITE_', 'TAURI_'],

  server: {
    port: DEV_SERVER_PORT,
    strictPort: true,
    watch: {
      ignored: ['**/src-tauri/**'],
    },
  },

  build: {
    target: 'esnext',
    sourcemap: false,
  },

  test: {
    // Avoid exhausting CPU and memory while transforming the full Vue component suite.
    maxWorkers: 4,
    environment: 'jsdom',
    globals: true,
    include: ['src/tests/unit/**/*.spec.ts', 'src/tests/component/**/*.spec.ts'],
    setupFiles: ['./src/tests/vitest.setup.ts'],
    coverage: {
      provider: 'v8',
      include: ['src/**/*.{ts,vue}'],
      exclude: ['src/main.ts', 'src/tests/**', 'src/**/*.d.ts', 'src/types/**'],
      reporter: ['text', 'lcov', 'html'],
      reportsDirectory: './coverage',
      thresholds: {
        functions: 80,
        statements: 80,
        lines: 80,
        branches: 75,
      },
    },
  },
});
