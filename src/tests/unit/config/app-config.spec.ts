import { describe, expect, it } from 'vitest';

import { APP_NAME, APP_VERSION, SUPPORTED_EXTENSIONS, isTauriRuntime } from '@/config/app-config';

describe('app-config', () => {
  it('exposes the app name and version', () => {
    expect(APP_NAME).toBe('TuneLib');
    expect(APP_VERSION).toMatch(/^\d+\.\d+\.\d+$/);
  });

  it('includes mp3 among supported formats', () => {
    expect(SUPPORTED_EXTENSIONS).toContain('mp3');
  });

  describe('isTauriRuntime', () => {
    it('is false in the test browser', () => {
      expect(isTauriRuntime()).toBe(false);
    });

    it('is true when the Tauri shell injected its runtime', () => {
      const scopedWindow = window as unknown as Record<string, unknown>;
      scopedWindow.__TAURI_INTERNALS__ = {};

      try {
        expect(isTauriRuntime()).toBe(true);
      } finally {
        delete scopedWindow.__TAURI_INTERNALS__;
      }
    });
  });
});
